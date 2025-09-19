# server/app/main.py (REFRESHED, slim)
import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Use uvloop for better performance
try:
    import uvloop
    uvloop.install()
except ImportError:
    pass  # Fall back to default event loop

import socketio  # type: ignore
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("app.main")

origin = os.getenv("ORIGIN", "http://localhost:3000")
allowed_origins = [origin]

# ── Socket.IO (Redis optional) ────────────────────────────────────────────────
redis_url = os.getenv("REDIS_URL")
if redis_url and socketio.AsyncRedisManager:
    logger.info(f"Socket.IO clustering via Redis -> {redis_url}")
    manager = socketio.AsyncRedisManager(redis_url)
    sio = socketio.AsyncServer(async_mode="asgi", client_manager=manager,
                               cors_allowed_origins=allowed_origins, transports=["websocket", "polling"])
else:
    logger.info("Socket.IO using in-memory manager")
    sio = socketio.AsyncServer(async_mode="asgi",
                               cors_allowed_origins=allowed_origins, transports=["websocket", "polling"])

# ── FastAPI ───────────────────────────────────────────────────────────────────
fastapi_app = FastAPI(title="GLOW API")
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compose ASGI app
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")

# ── Import training events exactly as before ──────────────────────────────────
from app.web.training import \
    register_training_events  # keep your existing semantics

register_training_events(sio)

# ── Import new WebRTC primitives (from your NEWMAIN extraction) ───────────────
from app.rtc import (WebRTCSession, get_room,  # get_room from your new code
                     sessions)


# ── Loop lag watchdog ─────────────────────────────────────────────────────────
async def _loop_lag_watchdog(threshold_ms: int = 150, period_ms: int = 50) -> None:
    """Monitor event loop lag and log warnings if it exceeds threshold.

    Controlled by env vars:
      - LOOP_LAG_WATCHDOG: "0" to disable (default: enabled)
      - LOOP_LAG_THRESHOLD_MS: warning threshold (default: 150)
      - LOOP_LAG_PERIOD_MS: sampling period (default: 50)
    """
    last = time.perf_counter()
    period = period_ms / 1000.0
    while True:
        await asyncio.sleep(period)
        now = time.perf_counter()
        lag_ms = (now - last - period) * 1000
        if lag_ms > threshold_ms:
            logger.warning("Event loop lag: %.1f ms", lag_ms)
        last = now

def _maybe_start_watchdog() -> None:
    enabled = os.getenv("LOOP_LAG_WATCHDOG", "1") != "0"
    if not enabled:
        return
    try:
        t_ms = int(os.getenv("LOOP_LAG_THRESHOLD_MS", "150"))
    except Exception:
        t_ms = 150
    try:
        p_ms = int(os.getenv("LOOP_LAG_PERIOD_MS", "50"))
    except Exception:
        p_ms = 50
    asyncio.create_task(_loop_lag_watchdog(threshold_ms=t_ms, period_ms=p_ms))

# ── sid <-> profile map (very light; OK to keep in-memory or back by Redis) ──
SID_TO_PROFILE: dict[str, str] = {}
# Allow multiple active sockets per profile
PROFILE_TO_SIDS: dict[str, set[str]] = {}

def get_socketio_instance() -> socketio.AsyncServer:
    return sio

def get_profile_id_for_sid(sid: str) -> Optional[str]:
    return SID_TO_PROFILE.get(sid)

import uuid

# ── Wire RTC emitter ──────────────────────────────────────────────────────────
from app import rtc
from app.db import session_scope
from app.models import Profiles
from app.store import set_emitter


# Set up the emitter for both RTC and store
async def emit_to_room(room_id: str, event: str, payload: dict) -> None:
    # Don't block the loop on broadcast/fanout
    sio.start_background_task(sio.emit, event, payload, room=room_id)

rtc.set_emitter(lambda sid, event, payload: sio.emit(event, payload, room=sid))
set_emitter(emit_to_room)

# ── Socket lifecycle (very light) ─────────────────────────────────────────────
@sio.event
async def connect(sid, environ, auth):
    # Start the loop lag watchdog on first connection (only once)
    if not hasattr(connect, '_watchdog_started'):
        _maybe_start_watchdog()
        connect._watchdog_started = True
    
    # read profileId from query string (?profileId=...)
    q = environ.get("QUERY_STRING", "") or ""
    profile_id = None
    if "profileId=" in q:
        try:
            profile_id = q.split("profileId=")[1].split("&")[0]
        except Exception:
            profile_id = None

    if profile_id:
        SID_TO_PROFILE[sid] = profile_id
        # Track this sid under the profile's active set
        sids = PROFILE_TO_SIDS.get(profile_id)
        if sids is None:
            sids = set()
            PROFILE_TO_SIDS[profile_id] = sids
        sids.add(sid)

    # Persist profile_id in Socket.IO session for Redis/clustering safety
    try:
        await sio.save_session(sid, {"profile_id": profile_id})
    except Exception:
        pass

    # Update profile activity in DB
    try:
        if profile_id:
            with session_scope() as db:
                try:
                    pid = uuid.UUID(profile_id)
                    p = db.get(Profiles, pid)
                    if p:
                        p.active = True
                        p.last_active = datetime.now(timezone.utc)
                        db.add(p)
                except Exception:
                    pass
    except Exception:
        pass

    # (optional, but handy)
    await sio.emit("server_capabilities", {"webrtc": True, "audio": True}, room=sid)
    await sio.emit("connection_confirmed", {"sid": sid, "server_time": time.time()}, room=sid)
    return True

@sio.event
async def disconnect(sid):
    s = sessions.pop(sid, None)
    if s:
        await sio.leave_room(sid, s.room.id)
        await s.close()
    # clean sid/profile maps
    pid = SID_TO_PROFILE.pop(sid, None)
    if pid:
        try:
            sids = PROFILE_TO_SIDS.get(pid)
            if sids is not None:
                sids.discard(sid)
                if len(sids) == 0:
                    # Last socket for this profile disconnected; mark inactive
                    PROFILE_TO_SIDS.pop(pid, None)
                    try:
                        with session_scope() as db:
                            try:
                                p = db.get(Profiles, uuid.UUID(pid))
                                if p:
                                    p.active = False
                                    p.last_active = datetime.now(timezone.utc)
                                    db.add(p)
                            except Exception:
                                pass
                    except Exception:
                        pass
        except Exception:
            pass

async def _force_close_sid(old_sid: str) -> None:
    try:
        old = sessions.pop(old_sid, None)
        if old:
            try:
                await sio.leave_room(old_sid, old.room.id)
            except Exception:
                pass
            try:
                await old.close()
            except Exception:
                pass
        try:
            await sio.disconnect(old_sid)
        except Exception:
            pass
    except Exception:
        pass

# ── WebRTC events (thin shim) ─────────────────────────────────────────────────
@sio.event
async def offer(sid, data: Dict[str, Any]):
    """
    Client sends SDP offer with { room_id: chat_id }.
    We join that room, spin a WebRTCSession, produce an answer.
    """
    room_id = data.get("room_id")
    if not room_id:
        # if omitted, fall back to a default room (get_room()) but we expect chat_id
        room_id = get_room().id

    await sio.enter_room(sid, room_id)
    room = get_room(room_id)

    # remember who this socket/user is for this room
    try:
        sess = await sio.get_session(sid)
    except Exception:
        sess = None
    pid_from_session = (sess or {}).get("profile_id") if isinstance(sess, dict) else None
    room.user_profile_id = pid_from_session or get_profile_id_for_sid(sid)

    # hook up text broadcast once (idempotent)
    if room.on_text_chunk is None:
        async def _broadcast(payload):
            await sio.emit("text_chunk", payload, room=room.id)
        room.on_text_chunk = _broadcast

    # Wire transcript broadcasters if not set
    if room.on_transcript is None:
        async def _broadcast_tx(payload):
            try:
                print(f"[ctc][emit] transcript words={len(payload.get('words', []))} msg={payload.get('message_id')} room={payload.get('room_id')}")
            except Exception:
                pass
            await sio.emit("transcript", payload, room=room.id)
        room.on_transcript = _broadcast_tx

    if room.on_transcript_stop is None:
        async def _broadcast_tx_stop(payload):
            try:
                print(f"[ctc][emit] transcript_stop msg={payload.get('message_id')} stop_ts={payload.get('stop_ts_ms')} room={payload.get('room_id')}")
            except Exception:
                pass
            await sio.emit("transcript_stop", payload, room=room.id)
        room.on_transcript_stop = _broadcast_tx_stop

    if sid not in sessions:
        sessions[sid] = WebRTCSession(sid, room_id)
    else:
        # If an old session exists for this sid, close it and recreate to avoid audio deadlocks
        try:
            old = sessions.pop(sid)
            await old.close()
        except Exception:
            pass
        sessions[sid] = WebRTCSession(sid, room_id)

    ans = await sessions[sid].handle_offer(data)
    await sio.emit("answer", ans, room=sid)

    # ✅ tell the client the server's out track is ready to play
    pid = pid_from_session or get_profile_id_for_sid(sid)
    await sio.emit("webrtc_audio_ready", {"profile_id": pid}, room=sid)

@sio.event
async def ice_candidate(sid, data: Dict[str, Any]):
    if sid in sessions:
        await sessions[sid].add_ice(data.get("candidate"))

# ── Health + info ─────────────────────────────────────────────────────────────
@fastapi_app.get("/")
async def root_info() -> JSONResponse:
    info = {"python_version": sys.version.split()[0]}
    return JSONResponse(content={"server_info": info})

@fastapi_app.get("/health")
async def health_check() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})

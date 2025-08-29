# server/app/main.py (REFRESHED, slim)
import logging
import os
import sys
import time
from typing import Any, Dict, Optional

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

# ── sid <-> profile map (very light; OK to keep in-memory or back by Redis) ──
SID_TO_PROFILE: dict[str, str] = {}
PROFILE_TO_SID: dict[str, str] = {}

def get_socketio_instance() -> socketio.AsyncServer:
    return sio

def get_profile_id_for_sid(sid: str) -> Optional[str]:
    return SID_TO_PROFILE.get(sid)

# ── Wire RTC emitter ──────────────────────────────────────────────────────────
from app import rtc

rtc.set_emitter(lambda sid, event, payload: sio.emit(event, payload, room=sid))

# ── Socket lifecycle (very light) ─────────────────────────────────────────────
@sio.event
async def connect(sid, environ, auth):
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
        PROFILE_TO_SID[profile_id] = sid

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
        PROFILE_TO_SID.pop(pid, None)

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

    # hook up text broadcast once (idempotent)
    if room.on_text_chunk is None:
        async def _broadcast(payload):
            await sio.emit("text_chunk", payload, room=room.id)
        room.on_text_chunk = _broadcast

    if sid not in sessions:
        sessions[sid] = WebRTCSession(sid, room_id)

    ans = await sessions[sid].handle_offer(data)
    await sio.emit("answer", ans, room=sid)

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")

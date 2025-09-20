from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import time
from fractions import Fraction
from typing import Any, AsyncIterator, Dict, Optional

import av
import numpy as np
import socketio  # type: ignore
# Removed aiortc imports - WebRTC handled by server
from dotenv import load_dotenv
from fastapi import FastAPI

from .bus import PCM_SR, SAMPLES_PER_CHUNK
from .extensions import warm_all_models
from .room import create_room_with_config, get_room
from .store import list_messages
from .transcripts import synthesize_via_model_service

load_dotenv()

# Configure logging similar to server/model
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("audio.main")

# Create a Socket.IO logger that filters out s2s_mixed_frame spam
class _SioFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
            if isinstance(msg, str) and ("s2s_mixed_frame" in msg):
                return False
        except Exception:
            pass
        return True

_sio_logger = logging.getLogger("audio.sio")
_sio_logger.setLevel(logging.INFO)
if not _sio_logger.handlers:
    _h = logging.StreamHandler()
    _h.setLevel(logging.INFO)
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    _h.addFilter(_SioFilter())
    _sio_logger.addHandler(_h)
_sio_logger.propagate = False

# Removed CORS configuration - this is server-to-server communication

AUDIO_SR = 48000
AUDIO_CH = 1


# Removed build_ice_servers - WebRTC handled by server


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack() as stack:
        # Startup: warm Kokoro TTS for real-time synthesis
        try:
            warm_all_models()
        except Exception:
            pass
        
        yield
        
        # Shutdown: cleanup if needed
        # Models will be cleaned up automatically when the process exits


fastapi_app = FastAPI(title="RTC2", lifespan=lifespan)
# Removed CORS middleware - this is server-to-server communication


# Re-enable Socket.IO logging by default; we will silence specific spammy logs below
sio = socketio.AsyncServer(
    async_mode="asgi", transports=["websocket", "polling"], logger=_sio_logger
)
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")


@sio.event
async def connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]]) -> bool:
    try:
        logger.info("audio socket connected: %s", sid)
    except Exception:
        pass
    return True


@sio.event
async def disconnect(sid: str) -> None:
    # stop any S2S mix tasks for this sid
    try:
        for key, task in list(MIX_TASKS.items()):
            k_sid, room_id_str, subscriber_id = key
            if k_sid == sid:
                try:
                    task.cancel()
                except Exception:
                    pass
                MIX_TASKS.pop(key, None)
                try:
                    get_room(room_id_str).bus.unsubscribe(subscriber_id)
                except Exception:
                    pass
    except Exception:
        pass


# ── S2S CONTROL + AUDIO INGEST/EGRESS ─────────────────────────────────────────

from typing import Dict as _Dict
from typing import Optional as _Optional
from typing import Tuple as _Tuple


def _check_secret_from_data(data: _Optional[dict]) -> bool:
    try:
        import os
        secret = os.getenv("AUDIO_SECRET", "")
        if not secret:
            return True
        token = None
        if isinstance(data, dict):
            token = data.get("authToken") or data.get("token")
        return bool(token) and (token == secret)
    except Exception:
        return True


@sio.event
async def s2s_start_room(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    
    # Expected fields
    room_id = str(data.get("room_id")) if data.get("room_id") is not None else None
    require_users = bool(data.get("require_users", True))
    idle_timeout_ms = data.get("idle_timeout_ms")
    try:
        idle_timeout_ms = int(idle_timeout_ms) if idle_timeout_ms is not None else None
    except Exception:
        idle_timeout_ms = None
    enable_word_timestamps = bool(data.get("enable_word_timestamps", True))
    name = data.get("name")
    if not isinstance(name, str):
        name = None
    problem_statement = data.get("problem_statement")
    if not isinstance(problem_statement, str):
        problem_statement = None
    objectives_raw = data.get("objectives")
    objectives = objectives_raw if isinstance(objectives_raw, list) else []
    objectives = [str(x) for x in objectives]
    agents_raw = data.get("agents")
    agents = agents_raw if isinstance(agents_raw, list) else []
    agents = [a for a in agents if isinstance(a, dict)]
    
    # Reduce noisy logs; keep one concise line
    logger.info(f"audio: start_room room_id=%s agents=%d require_users=%s", room_id, len(agents), require_users)
    room = create_room_with_config(
        room_id=room_id,
        require_users=require_users,
        idle_timeout_ms=idle_timeout_ms,
        enable_word_timestamps=enable_word_timestamps,
        name=name,
        problem_statement=problem_statement,
        objectives=objectives,
        agents=agents,
    )
    await sio.enter_room(sid, room.id)

    # Wire up broadcasters to this room id if not already
    if room.on_text_chunk is None:
        async def _text_broadcast(payload: Dict[str, Any]) -> None:
            # Attempt to enrich payload with persona_id using agent mapping if available
            try:
                src = payload.get("source_id") or payload.get("agent_id")
                persona_id = None
                if isinstance(src, str) and not src.startswith("user:"):
                    # find matching agent spec by name portion
                    name = src.split(":", 1)[-1]
                    for a in agents:
                        if (a.get("name") or "") == name and a.get("persona_id"):
                            persona_id = a.get("persona_id")
                            break
                elif isinstance(src, str) and src.startswith("user:"):
                    # map user profile to persona if present
                    prof = src.split(":", 1)[-1]
                    for a in agents:
                        if a.get("user") and (a.get("profile_id") or "") == prof and a.get("persona_id"):
                            persona_id = a.get("persona_id")
                            break
                if persona_id and isinstance(payload, dict):
                    payload = dict(payload)
                    payload["persona_id"] = persona_id
            except Exception:
                pass
            await sio.emit("text_chunk", payload, room=room.id)
        room.on_text_chunk = _text_broadcast
    if room.on_transcript is None:
        async def _tx(payload: Dict[str, Any]) -> None:
            await sio.emit("transcript", payload, room=room.id)
        room.on_transcript = _tx
    if room.on_transcript_stop is None:
        async def _txs(payload: Dict[str, Any]) -> None:
            await sio.emit("transcript_stop", payload, room=room.id)
        room.on_transcript_stop = _txs

    # Provide a helper for direct agent text (used by two-party optimization)
    # This avoids callers poking at private attributes on the agent objects.
    async def _send_direct_text(agent_id: str, text: str) -> None:
        try:
            for a in list(room.agents):
                try:
                    if getattr(a, "id", None) == agent_id and hasattr(a, "send_text"):
                        await getattr(a, "send_text")(text)
                        break
                except Exception:
                    pass
        except Exception:
            pass
    try:
        setattr(room, "send_agent_text", _send_direct_text)
    except Exception:
        pass

    return {"room_id": room.id}


@sio.event
async def s2s_register_human(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    room_id = data.get("room_id")
    human_id = data.get("human_id") or sid
    room = get_room(room_id)
    try:
        # Robust adoption: if this human corresponds to a pseudo user agent (dynamic config
        # path when require_users=False), remove that pseudo agent so the real human speaks
        try:
            # human_id may be formatted as "user:<profile_id>" when provided by server bridge
            profile_id = None
            if isinstance(human_id, str) and human_id.startswith("user:"):
                profile_id = human_id.split(":", 1)[-1]
            # Only applicable when scenario allows pseudo users
            allow_pseudo = not bool(room.scenario_config.get("require_users", True))
            if allow_pseudo and profile_id:
                pseudo_map = getattr(room, "_pseudo_user_by_profile_id", {})
                pseudo_agent_id = pseudo_map.get(profile_id)
                if isinstance(pseudo_agent_id, str) and pseudo_agent_id:
                    from .room import _remove_agent_from_room
                    _remove_agent_from_room(room, pseudo_agent_id)
                    try:
                        pseudo_map.pop(profile_id, None)
                    except Exception:
                        pass
        except Exception:
            pass

        room.register_agent(human_id, "human")
        # Ensure server connection hears the mixed output but not their own mic
        room.bus.set_ignore(human_id, {human_id, "agent:beep"})
        room.start_monitor()
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@sio.event
async def s2s_ingest_frame(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    import base64

    import numpy as np  # type: ignore
    try:
        room_id = data["room_id"]
        source_id = data["source_id"]
        sr = int(data.get("sr", AUDIO_SR))
        raw = base64.b64decode(data["frame_b64"]) if isinstance(data.get("frame_b64"), str) else data.get("frame_b64")
        if not isinstance(raw, (bytes, bytearray)):
            return {"error": "bad frame"}
        x = np.frombuffer(raw, dtype=np.int16)
        room = get_room(room_id)
        await room.bus.ingest_i16(source_id, x, sr)
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@sio.event
async def s2s_user_text(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    # Reuse typed-to-TTS flow by directly synthesizing and injecting
    try:
        room_id = data.get("room_id")
        human_id = data.get("human_id") or sid
        text = (data.get("text") or "").strip()
        text_only = bool(data.get("text_only", False))
        if not text:
            return {"error": "empty"}
        room = get_room(room_id)
        if text_only:
            # Special path: with exactly 2 participants (one human, one agent), do not TTS.
            # Publish user text via room so it is broadcasted to server/clients and persisted.
            try:
                await room.append_text_chunk(
                    source_id=human_id,
                    role="user",
                    text=text,
                    message_id=None,
                    chunk_idx=0,
                    is_final=True,
                )
            except Exception:
                pass
            # Find the sole agent and send text directly if supported
            try:
                agent_ids = [aid for aid, kind in room.agent_meta.items() if kind == "agent" and aid != "agent:beep"]
                if len(agent_ids) == 1:
                    for a in list(room.agents):
                        try:
                            if getattr(a, "id", None) == agent_ids[0]:
                                # Send text using the agent helper which waits for session readiness
                                try:
                                    send_fn = getattr(a, "send_text", None)
                                    if callable(send_fn):
                                        await send_fn(text)
                                except Exception:
                                    pass
                                # Ensure a placeholder assistant message exists for transcript/text updates
                                try:
                                    await room.append_text_chunk(
                                        source_id=agent_ids[0], role="agent", text="", message_id=None, chunk_idx=0, is_final=False
                                    )
                                except Exception:
                                    pass
                                break
                        except Exception:
                            pass
            except Exception:
                pass
        else:
            msg_id = await room.append_text_chunk(
                source_id=human_id, role="user", text="", message_id=None, chunk_idx=0, is_final=False
            )
            await room.recorder_start_message(human_id, label="typed")
            audio_f32, sr = await synthesize_via_model_service(text, "alloy", PCM_SR)
            if audio_f32 is not None and getattr(audio_f32, "size", 0) > 0:
                # Optional: early words via model service
                try:
                    from .transcripts import align_via_model_service
                    tr = await align_via_model_service(audio_f32, sr, text, stage="final")
                    words = [{"start_ms": w.start_ms, "end_ms": w.end_ms, "text": w.text} for w in tr.words]
                    if words and room.on_transcript:
                        await room.broadcast_transcript(agent_id=human_id, message_id=msg_id, start_ts_ms=int(time.time()*1000), words=words, full_text=text)
                except Exception:
                    pass
                # Stream into bus
                for i in range(0, audio_f32.size, SAMPLES_PER_CHUNK):
                    frame = audio_f32[i:i+SAMPLES_PER_CHUNK]
                    if frame.size == 0:
                        continue
                    i16 = (np.clip(frame, -1.0, 1.0) * 32767.0).astype(np.int16)
                    await room.bus.ingest_i16(human_id, i16, PCM_SR)
                    await asyncio.sleep(SAMPLES_PER_CHUNK / PCM_SR)
            await room.append_text_chunk(source_id=human_id, role="user", text=text, message_id=msg_id, chunk_idx=0, is_final=True)
            room.schedule_segment_close_after_tail(human_id)
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@sio.event
async def s2s_stop_room(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    try:
        room_id_val = data.get("room_id")
        if not isinstance(room_id_val, str):
            return {"error": "room_id required"}
        from .room import cleanup_room
        await cleanup_room(room_id_val)
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


# Background mixed-audio egress tasks keyed by (sid, room_id, subscriber_id)
MIX_TASKS: _Dict[_Tuple[str, str, str], asyncio.Task] = {}


@sio.event
async def s2s_subscribe_mix(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    import base64
    try:
        room_id = data.get("room_id")
        subscriber_id = data.get("subscriber_id") or sid
        room = get_room(room_id)
        # subscribe with the provided subscriber_id; this controls self-echo suppression
        sub = room.bus.subscribe(subscriber_id)
        # default ignore: own id and beep
        try:
            base = set([subscriber_id, "agent:beep"])  # ignore own mic and beep by default
            room.bus.set_ignore(subscriber_id, base)
        except Exception:
            pass

        key = (sid, room.id, subscriber_id)
        if key in MIX_TASKS:
            try:
                MIX_TASKS[key].cancel()
            except Exception:
                pass
        async def _pump() -> None:
            try:
                while True:
                    ch = await sub.recv()
                    i16 = (np.clip(ch.data, -1.0, 1.0) * 32767.0).astype(np.int16)
                    b64 = base64.b64encode(i16.tobytes()).decode("ascii")
                    payload = {
                        "room_id": room.id,
                        "subscriber_id": subscriber_id,
                        "sr": PCM_SR,
                        "format": "pcm16",
                        "frame_b64": b64,
                        "meta": ch.meta,
                    }
                    # Avoid per-frame log spam; emit quietly
                    await sio.emit("s2s_mixed_frame", payload, room=sid)
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
        t = asyncio.create_task(_pump())
        MIX_TASKS[key] = t
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@sio.event
async def s2s_unsubscribe_mix(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    try:
        room_id = data.get("room_id")
        subscriber_id = data.get("subscriber_id") or sid
        key = (sid, room_id, subscriber_id)
        t = MIX_TASKS.pop(key, None)  # type: ignore
        if t:
            try:
                t.cancel()
            except Exception:
                pass
        try:
            get_room(room_id).bus.unsubscribe(subscriber_id)
        except Exception:
            pass
        return {"ok": True}
    except Exception as e:
        return {"error": str(e)}


@fastapi_app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}

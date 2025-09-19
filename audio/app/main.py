from __future__ import annotations

import asyncio
import contextlib
import json
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


sio = socketio.AsyncServer(
    async_mode="asgi", transports=["websocket", "polling"]
)
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")


@sio.event
async def connect(sid: str, environ: Dict[str, Any], auth: Optional[Dict[str, Any]]) -> bool:
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

    return {"room_id": room.id}


@sio.event
async def s2s_register_human(sid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    if not _check_secret_from_data(data):
        return {"error": "unauthorized"}
    room_id = data.get("room_id")
    human_id = data.get("human_id") or sid
    room = get_room(room_id)
    try:
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
        if not text:
            return {"error": "empty"}
        room = get_room(room_id)
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

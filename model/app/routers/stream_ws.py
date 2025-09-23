# app/routers/stream_ws.py
import json
from time import monotonic
from typing import Any, Dict, Optional

import socketio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..asr.fast_streamer import FasterWhisperStreamer

try:
    from ..asr.vad import SileroGate
    USE_VAD = True
except Exception:
    SileroGate = None  # type: ignore
    USE_VAD = False

router = APIRouter()

# Auto-detect device based on availability
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"

streamer = FasterWhisperStreamer(
    model_name="small.en",   # small/medium for live, large-v3 for offline
    device=device,           # auto-detect CUDA/CPU
    word_timestamps_live=True,
)

vad: Optional[SileroGate] = SileroGate() if USE_VAD else None
POLL_SEC = 0.5  # matches streamer's MIN_EMIT_INTERVAL_S

# Create Socket.IO server
sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode="asgi")

# Socket.IO event handlers
@sio.event
async def connect(sid: str, environ: Dict[str, Any]) -> None:
    """Handle Socket.IO connection."""
    print(f"Client {sid} connected")

@sio.event
async def disconnect(sid: str) -> None:
    """Handle Socket.IO disconnection."""
    print(f"Client {sid} disconnected")

@sio.event
async def audio_data(sid: str, data: bytes) -> None:
    """Handle incoming audio data."""
    try:
        if vad is not None:
            speech = vad.is_speech(data)
            streamer.mark_speech_activity(speech)
        streamer.feed_pcm16(data)
        
        # Poll for results
        print(f"DEBUG: streamer type: {type(streamer)}")
        print(f"DEBUG: streamer.poll type: {type(streamer.poll)}")
        partial, finals = streamer.poll()
        if partial:
            await sio.emit("partial_result", {"text": partial}, room=sid)
        for seg in finals:
            payload: Dict[str, Any] = {
                "text": seg.text,
                "start": seg.start,
                "end": seg.end,
            }
            if seg.words:
                payload["words"] = seg.words
            await sio.emit("final_result", payload, room=sid)
    except Exception as e:
        print(f"Error processing audio data: {e}")
        import traceback
        traceback.print_exc()

@router.websocket("/ws/whisper")
async def ws_whisper(ws: WebSocket) -> None:
    await ws.accept()
    last_poll = monotonic()
    try:
        while True:
            data = await ws.receive_bytes()  # raw PCM s16le, mono, 16 kHz, ~20–40 ms frames
            if vad is not None:
                speech = vad.is_speech(data)
                streamer.mark_speech_activity(speech)
                if not speech:
                    # still feed a little silence so the timeline advances
                    pass
            streamer.feed_pcm16(data)

            now = monotonic()
            if (now - last_poll) >= POLL_SEC:
                partial, finals = streamer.poll()
                if partial:
                    await ws.send_text(json.dumps({"type": "partial", "text": partial}))
                for seg in finals:
                    payload: Dict[str, Any] = {
                        "type": "final",
                        "text": seg.text,
                        "start": seg.start,
                        "end": seg.end,
                    }
                    if seg.words:
                        payload["words"] = seg.words
                    await ws.send_text(json.dumps(payload))
                last_poll = now
    except WebSocketDisconnect:
        # one last flush
        partial, finals = streamer.poll()
        for seg in finals:
            await ws.send_text(json.dumps({
                "type": "final", "text": seg.text, "start": seg.start, "end": seg.end
            }))
        await ws.close()

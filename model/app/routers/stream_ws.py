# app/routers/stream_ws.py
import json
import os
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

# ---- Configurable sensitivity and preamp ----
VAD_THRESHOLD = float(os.getenv("VAD_THRESHOLD", "0.35"))  # lower = more sensitive
VAD_START_FRAMES = int(os.getenv("VAD_START_FRAMES", "3"))
VAD_STOP_FRAMES = int(os.getenv("VAD_STOP_FRAMES", "8"))
INPUT_PREAMP_DB = float(os.getenv("INPUT_PREAMP_DB", "12"))  # positive boosts volume into VAD/ASR

streamer = FasterWhisperStreamer(
    model_name="tiny.en",    # tiny for fastest real-time processing
    device=device,           # auto-detect CUDA/CPU
    beam_size=3,            # optimal balance of speed and accuracy
    word_timestamps_live=True,
)
_utter_audio: dict[str, bytearray] = {}

vad: Optional[SileroGate] = SileroGate(threshold=VAD_THRESHOLD) if USE_VAD else None
# VAD hysteresis state per client
_vad_state: dict[str, Dict[str, Any]] = {}
# frames at ~20–40ms each; already configurable via env above
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
        # Optional input preamp for VAD/ASR robustness
        pcm = data
        if INPUT_PREAMP_DB != 0.0:
            try:
                import numpy as _np
                g = float(10.0 ** (INPUT_PREAMP_DB / 20.0))
                x = _np.frombuffer(pcm, dtype=_np.int16).astype(_np.float32)
                x = _np.clip(x * g, -32768.0, 32767.0).astype(_np.int16)
                pcm = x.tobytes()
            except Exception:
                pcm = data

        if vad is not None:
            speech_now = vad.is_speech(pcm)
            streamer.mark_speech_activity(speech_now)

            st = _vad_state.setdefault(sid, {"active": False, "t": 0, "f": 0})
            if speech_now:
                st["t"] += 1
                st["f"] = 0
            else:
                st["f"] += 1
                st["t"] = 0

            # Rising edge with hysteresis
            if (not st["active"]) and st["t"] >= VAD_START_FRAMES:
                st["active"] = True
                await sio.emit("speech_started", {"ts": monotonic()}, room=sid)
                _utter_audio[sid] = bytearray()
            # Falling edge with hysteresis
            elif st["active"] and st["f"] >= VAD_STOP_FRAMES:
                st["active"] = False
                await sio.emit("speech_stopped", {"ts": monotonic()}, room=sid)
                # On stop, run a high-quality pass over the accumulated audio and emit utterance_final
                try:
                    import numpy as np

                    from ..transcripts import transcribe_and_align_whisper
                    buf = _utter_audio.pop(sid, bytearray())
                    if buf:
                        x16 = np.frombuffer(bytes(buf), dtype=np.int16).astype(np.float32) / 32768.0
                        tr = transcribe_and_align_whisper(x16, 16000)
                        words = [
                            {"start_ms": int(w.start_ms), "end_ms": int(w.end_ms), "text": w.text}
                            for w in tr.words
                        ]
                        await sio.emit("utterance_final", {"text": tr.text, "words": words}, room=sid)
                except Exception:
                    pass
        streamer.feed_pcm16(pcm)
        try:
            _utter_audio.setdefault(sid, bytearray()).extend(pcm)
        except Exception:
            pass

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
        st = {"active": False, "t": 0, "f": 0}
        while True:
            data = await ws.receive_bytes()  # raw PCM s16le, mono, 16 kHz, ~20–40 ms frames
            # Optional input preamp for VAD/ASR
            pcm = data
            if INPUT_PREAMP_DB != 0.0:
                try:
                    import numpy as _np
                    g = float(10.0 ** (INPUT_PREAMP_DB / 20.0))
                    x = _np.frombuffer(pcm, dtype=_np.int16).astype(_np.float32)
                    x = _np.clip(x * g, -32768.0, 32767.0).astype(_np.int16)
                    pcm = x.tobytes()
                except Exception:
                    pcm = data

            if vad is not None:
                speech_now = vad.is_speech(pcm)
                streamer.mark_speech_activity(speech_now)
                if speech_now:
                    st["t"] += 1; st["f"] = 0
                else:
                    st["f"] += 1; st["t"] = 0
                if (not st["active"]) and st["t"] >= VAD_START_FRAMES:
                    st["active"] = True
                    await ws.send_text(json.dumps({"type": "speech_started"}))
                    _utter_audio["ws"] = bytearray()
                elif st["active"] and st["f"] >= VAD_STOP_FRAMES:
                    st["active"] = False
                    await ws.send_text(json.dumps({"type": "speech_stopped"}))
                    try:
                        import numpy as np

                        from ..transcripts import transcribe_and_align_whisper
                        buf = _utter_audio.pop("ws", bytearray())
                        if buf:
                            x16 = np.frombuffer(bytes(buf), dtype=np.int16).astype(np.float32) / 32768.0
                            tr = transcribe_and_align_whisper(x16, 16000)
                            words = [
                                {"start_ms": int(w.start_ms), "end_ms": int(w.end_ms), "text": w.text}
                                for w in tr.words
                            ]
                            await ws.send_text(json.dumps({"type": "utterance_final", "text": tr.text, "words": words}))
                    except Exception:
                        pass
                if not speech_now:
                    # still feed a little silence so the timeline advances
                    pass
            streamer.feed_pcm16(pcm)
            try:
                _utter_audio.setdefault("ws", bytearray()).extend(pcm)
            except Exception:
                pass

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

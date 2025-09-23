# app/routers/stream_ws.py
import json
from time import monotonic

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..asr.fast_streamer import FasterWhisperStreamer

try:
    from ..asr.vad import SileroGate
    USE_VAD = True
except Exception:
    SileroGate = None
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

vad = SileroGate() if USE_VAD else None
POLL_SEC = 0.5  # matches streamer's MIN_EMIT_INTERVAL_S

@router.websocket("/ws/whisper")
async def ws_whisper(ws: WebSocket):
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
                    payload = {
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

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np


async def synthesize_via_model_service(
    text: str,
    voice: str = "alloy",
    sr: int = 48000,
) -> Tuple[np.ndarray, int]:
    """Call external model service /synthesize for TTS, return audio data and sample rate."""
    import base64
    import os
    try:
        base = os.getenv("MODEL_SERVICE_URL") or ""
        if not base.strip():
            raise RuntimeError("MODEL_SERVICE_URL not set")
        try:
            import httpx  # type: ignore
        except Exception:
            raise RuntimeError("httpx unavailable")
        
        payload = {
            "text": str(text),
            "voice": str(voice),
            "sample_rate": int(sr),
        }
        url = base.rstrip("/") + "/synthesize"
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            obj = r.json()
        
        # Decode audio
        audio_b64 = obj.get("audio_b64", "")
        if not audio_b64:
            raise RuntimeError("No audio data in response")
        
        raw = base64.b64decode(audio_b64)
        audio_data = np.frombuffer(raw, dtype=np.float32)
        sample_rate = int(obj.get("sample_rate", sr))
        
        return audio_data, sample_rate
    except Exception as e:
        # Fallback: generate silence with a tone
        dur_s = max(0.4, min(8.0, len(text.split()) * 0.35))
        n = int(round(dur_s * sr))
        t = np.arange(n, dtype=np.float32) / float(sr)
        y = (0.05 * np.sin(2 * np.pi * 220.0 * t)).astype(np.float32)
        return y, sr


async def align_via_model_service(
    audio_f32: np.ndarray,
    sr: int,
    reference_text: str,
    *,
    stage: str = "final",
    num_chunks: Optional[int] = None,
    chunk_ms: int = 20,
) -> Transcript:
    """Call external model service /align_ctc if configured, else return empty transcript.

    The model service accepts base64 of PCM float32 or int16. We send float32 for fidelity.
    """
    import base64
    import os
    try:
        base = os.getenv("MODEL_SERVICE_URL") or ""
        if not base.strip():
            raise RuntimeError("MODEL_SERVICE_URL not set")
        try:
            import httpx  # type: ignore
        except Exception:
            raise RuntimeError("httpx unavailable")
        x = np.asarray(audio_f32, dtype=np.float32)
        raw = x.tobytes()
        payload = {
            "audio_b64": base64.b64encode(raw).decode("ascii"),
            "sr": int(sr),
            "reference_text": str(reference_text or ""),
            "stage": stage,
            "num_chunks": int(num_chunks) if num_chunks is not None else None,
            "chunk_ms": int(chunk_ms),
        }
        url = base.rstrip("/") + "/align_ctc"
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            obj = r.json()
        words = [
            Word(start_ms=int(w.get("start_ms", 0)), end_ms=int(w.get("end_ms", 0)), text=str(w.get("text", "")))
            for w in (obj.get("words") or [])
        ]
        txt = str(obj.get("text") or reference_text or "")
        return Transcript(words=words, text=txt)
    except Exception:
        # No local fallback; return empty transcript on failure
        return Transcript(words=[], text=str(reference_text or ""))


@dataclass
class Word:
    start_ms: int
    end_ms: int
    text: str


@dataclass
class Transcript:
    words: List[Word]
    text: str


# Kokoro TTS functionality has been moved to the model service
# Use synthesize_via_model_service() to call the model service for TTS

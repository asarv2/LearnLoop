from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np


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


from functools import lru_cache

# Optional: map your abstract voice names to Kokoro voices
VOICE_MAP = {
    "alloy": "af_heart",
}

@lru_cache(maxsize=1)
def _get_kokoro_pipeline(lang_code: str = "a") -> object:
    # 🇺🇸 'a' American English, 'b' British, etc.
    from kokoro import KPipeline  # type: ignore
    return KPipeline(lang_code=lang_code, repo_id="hexgrad/Kokoro-82M")  # type: ignore


def _resample_linear(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out or x.size == 0:
        return x.astype(np.float32, copy=False)
    ratio = sr_out / float(sr_in)
    n_out = max(1, int(round(x.size * ratio)))
    xi = np.arange(x.size, dtype=np.float32)
    idx = np.linspace(0, x.size - 1, num=n_out, dtype=np.float32)
    return np.interp(idx, xi, x).astype(np.float32)


def synthesize_kokoro(text: str, voice: str = "alloy", sr: int = 48000) -> Tuple[np.ndarray, int]:
    """
    Generate with Kokoro at 24 kHz, then resample to `sr` (bus is 48 kHz).
    """
    try:
        kokoro_voice = VOICE_MAP.get(voice, voice)
        pipeline = _get_kokoro_pipeline(lang_code="a")  # type: ignore
        gen = pipeline(text, voice=kokoro_voice, speed=1.0, split_pattern=r"\n+")  # type: ignore
        chunks = []
        for _, _, audio24 in gen:
            chunks.append(np.asarray(audio24, dtype=np.float32))
        if not chunks:
            return np.zeros(0, dtype=np.float32), sr
        y24 = np.concatenate(chunks, axis=0).astype(np.float32)
        y = _resample_linear(y24, 24000, sr)
        return y, sr
    except Exception:
        dur_s = max(0.4, min(8.0, len(text.split()) * 0.35))
        n = int(round(dur_s * sr))
        t = np.arange(n, dtype=np.float32) / float(sr)
        y = (0.05 * np.sin(2 * np.pi * 220.0 * t)).astype(np.float32)
        return y, sr

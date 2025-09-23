from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Tuple

import numpy as np

# ---------- logging & warnings ----------
logger = logging.getLogger("model_service")
# Ensure the 'model_service' logger is visible even under Uvicorn's logging config
try:
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        _h = logging.StreamHandler()
        _h.setLevel(logging.INFO)
        _h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(_h)
    # Avoid double-printing via root logger
    logger.propagate = False
except Exception:
    # Fallback to basicConfig if direct handler setup fails
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Suppress benign CTC warning from transformers
import warnings

warnings.filterwarnings("ignore", message=".*masked_spec_embed.*")

# Suppress transformers verbosity for cleaner logs
try:
    from transformers.utils.logging import set_verbosity  # type: ignore
    set_verbosity(40)  # ERROR level
except ImportError:
    pass

BASE = Path(__file__).resolve().parents[1]
MODEL_CACHE_DIR = BASE / "model_cache"

MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ---------- model warmers / singletons ----------

@lru_cache(maxsize=1)
def get_wav2vec2_ctc() -> Tuple[Any, Any]:
    try:
        from transformers import Wav2Vec2ForCTC  # type: ignore
        from transformers import Wav2Vec2Processor

        model_name = "facebook/wav2vec2-base-960h"
        cache_dir = str(MODEL_CACHE_DIR / "wav2vec2")
        
        proc = Wav2Vec2Processor.from_pretrained(model_name, cache_dir=cache_dir)
        mdl = Wav2Vec2ForCTC.from_pretrained(model_name, cache_dir=cache_dir).eval()
        logger.info(f"Initialized Wav2Vec2ForCTC and Wav2Vec2Processor ({model_name}) - cached in {cache_dir}")
        return proc, mdl
    except Exception as e:
        logger.warning(f"Wav2Vec2 warm load failed: {e}")
        return None, None


@lru_cache(maxsize=1)
def get_whisper_tiny(device_hint: str = "auto") -> Any:
    try:
        import ctranslate2  # type: ignore
        from faster_whisper import WhisperModel  # type: ignore

        # Check for environment override first
        env_device = os.getenv("WHISPER_DEVICE")
        if env_device in ("cpu", "cuda"):
            device_hint = env_device

        # Use CTranslate2 device detection instead of torch.cuda
        has_cuda = getattr(ctranslate2, "get_cuda_device_count", lambda: 0)() > 0
        if device_hint == "cuda":
            device = "cuda" if has_cuda else "cpu"
        elif device_hint == "cpu":
            device = "cpu"
        else:
            device = "cuda" if has_cuda else "cpu"

        compute_type = "float16" if device == "cuda" else "int8"
        cache_dir = str(MODEL_CACHE_DIR / "whisper")
        model = WhisperModel("tiny", device=device, compute_type=compute_type, download_root=cache_dir)
        logger.info(f"Initialized WhisperModel (tiny) on device={device} with compute_type={compute_type} - cached in {cache_dir} (CTranslate2 CUDA devices: {getattr(ctranslate2, 'get_cuda_device_count', lambda: 0)()})")
        return model
    except Exception as e:
        logger.warning(f"Whisper warm load failed: {e}")
        return None


# ---------- TTS (Kokoro) ----------

# Optional: map your abstract voice names to Kokoro voices
VOICE_MAP = {
    "alloy": "af_heart",
}

@lru_cache(maxsize=1)
def get_kokoro_pipeline(lang_code: str = "a") -> Any:
    """Get Kokoro TTS pipeline for text-to-speech synthesis."""
    try:
        from kokoro import KPipeline  # type: ignore
        pipeline = KPipeline(lang_code=lang_code, repo_id="hexgrad/Kokoro-82M")  # type: ignore
        logger.info(f"Initialized Kokoro KPipeline(lang_code='{lang_code}', repo_id='hexgrad/Kokoro-82M')")
        return pipeline
    except Exception as e:
        logger.warning(f"Kokoro pipeline load failed: {e}")
        return None


def _resample_linear(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    """Linear resampling of audio data."""
    if sr_in == sr_out or x.size == 0:
        return x.astype(np.float32, copy=False)
    ratio = sr_out / float(sr_in)
    n_out = max(1, int(round(x.size * ratio)))
    xi = np.arange(x.size, dtype=np.float32)
    idx = np.linspace(0, x.size - 1, num=n_out, dtype=np.float32)
    return np.interp(idx, xi, x).astype(np.float32)


def synthesize_kokoro(text: str, voice: str = "alloy", sr: int = 48000) -> Tuple[np.ndarray, int]:
    """
    Generate speech with Kokoro at 24 kHz, then resample to target sample rate.
    
    Args:
        text: Text to synthesize
        voice: Voice name (default: "alloy")
        sr: Target sample rate (default: 48000)
    
    Returns:
        Tuple of (audio_data, sample_rate)
    """
    try:
        pipeline = get_kokoro_pipeline(lang_code="a")
        if pipeline is None:
            raise RuntimeError("Kokoro pipeline not available")
            
        kokoro_voice = VOICE_MAP.get(voice, voice)
        gen = pipeline(text, voice=kokoro_voice, speed=1.0, split_pattern=r"\n+")  # type: ignore
        chunks = []
        for _, _, audio24 in gen:
            chunks.append(np.asarray(audio24, dtype=np.float32))
        if not chunks:
            return np.zeros(0, dtype=np.float32), sr
        y24 = np.concatenate(chunks, axis=0).astype(np.float32)
        y = _resample_linear(y24, 24000, sr)
        return y, sr
    except Exception as e:
        logger.warning(f"Kokoro synthesis failed: {e}")
        # Fallback: generate silence with a tone
        dur_s = max(0.4, min(8.0, len(text.split()) * 0.35))
        n = int(round(dur_s * sr))
        t = np.arange(n, dtype=np.float32) / float(sr)
        y = (0.05 * np.sin(2 * np.pi * 220.0 * t)).astype(np.float32)
        return y, sr


def warm_all_models() -> None:
    """Warm up all models for faster first inference."""
    # Fire and forget warmups; ignore failures
    try:
        get_wav2vec2_ctc()
    except Exception:
        pass
    try:
        get_whisper_tiny("auto")
    except Exception:
        pass
    try:
        get_kokoro_pipeline("a")
    except Exception:
        pass
    try:
        # Warm up faster-whisper streamer
        warm_faster_whisper_streamer()
    except Exception:
        pass


def warm_faster_whisper_streamer() -> None:
    """Warm up the faster-whisper streamer for WebSocket endpoint."""
    try:
        from .routers.stream_ws import streamer
        
        logger.info("Warming up faster-whisper streamer...")
        silence = (np.zeros(16000, dtype=np.int16)).tobytes()
        for _ in range(50):  # ~1s
            streamer.feed_pcm16(silence)
        streamer.poll()
        logger.info("Streamer warmup complete")
    except Exception as e:
        logger.warning(f"Streamer warmup failed: {e}")

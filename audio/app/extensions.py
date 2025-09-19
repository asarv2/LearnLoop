# app/extensions.py
from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Tuple

# ---------- logging & warnings ----------
logger = logging.getLogger("tts")
# Ensure the 'tts' logger is visible even under Uvicorn's logging config
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
    from transformers.utils.logging import set_verbosity
    set_verbosity(40)  # ERROR level
except ImportError:
    pass

BASE = Path(__file__).resolve().parents[2]
AUDIO_DIR = BASE / "audio"

AUDIO_DIR.mkdir(parents=True, exist_ok=True)


# ---------- model warmers / singletons ----------

@lru_cache(maxsize=1)
def get_wav2vec2_ctc() -> Tuple[Any, Any]:
    try:
        from transformers import Wav2Vec2ForCTC  # type: ignore
        from transformers import Wav2Vec2Processor

        proc = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
        mdl = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h").eval()
        logger.info("Initialized Wav2Vec2ForCTC and Wav2Vec2Processor (facebook/wav2vec2-base-960h)")
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
        model = WhisperModel("tiny", device=device, compute_type=compute_type)
        logger.info(f"Initialized WhisperModel (tiny) on device={device} with compute_type={compute_type} (CTranslate2 CUDA devices: {getattr(ctranslate2, 'get_cuda_device_count', lambda: 0)()})")
        return model
    except Exception as e:
        logger.warning(f"Whisper warm load failed: {e}")
        return None




def warm_all_models() -> None:
    # Fire and forget warmups; ignore failures
    try:
        get_wav2vec2_ctc()
    except Exception:
        pass
    try:
        get_whisper_tiny("auto")
    except Exception:
        pass
    # WhisperX removed
    # NEW: warm Kokoro so first synth isn't cold
    try:
        from .transcripts import _get_kokoro_pipeline  # type: ignore
        _get_kokoro_pipeline("a")
        logger.info("Initialized Kokoro KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')")
    except Exception as e:
        logger.warning(f"Kokoro warm load failed: {e}")

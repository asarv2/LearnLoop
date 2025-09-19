# app/extensions.py
from __future__ import annotations

import logging
from pathlib import Path

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

# Suppress warnings for cleaner logs
import warnings

# Suppress any model-related warnings since models are handled by the model service
warnings.filterwarnings("ignore", message=".*masked_spec_embed.*")

BASE = Path(__file__).resolve().parents[2]
AUDIO_DIR = BASE / "audio"

AUDIO_DIR.mkdir(parents=True, exist_ok=True)


# ---------- model warmers / singletons ----------
# All model loading has been moved to the model service
# The audio service now uses the model service for transcription and alignment

def warm_all_models() -> None:
    """Warm up models - now a no-op since all models are handled by the model service."""
    # All model loading has been moved to the model service
    # This function is kept for compatibility but does nothing
    logger.info("Model warming skipped - all models handled by model service")

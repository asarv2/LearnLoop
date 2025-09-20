"""
LearnLoop Model Service - CTC Transcription and Audio Processing

This service provides FastAPI endpoints for:
- Audio transcription using Whisper
- CTC-based audio-text alignment using Wav2Vec2
- Health checks and model status
"""

import logging
import os
import sys
from pathlib import Path

import uvicorn

# Add the app directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from app.api import app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
    ]
)

logger = logging.getLogger("model_service")
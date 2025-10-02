from __future__ import annotations

import base64
import logging
import tempfile
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import soundfile as sf  # type: ignore
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import extensions  # type: ignore
from .transcripts import align_audio  # type: ignore

logger = logging.getLogger("model_service")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Lifespan event handler for model warmup."""
    logger.info("Starting up model service...")
    extensions.warm_all_models()
    logger.info("Model service startup complete")
    yield


# Create FastAPI app
app = FastAPI(
    title="LearnLoop Model Service",
    description="CTC Transcription and Audio Processing API",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranscriptResponse(BaseModel):
    text: str
    words: list[dict[str, int | str]]
    audio_b64: str | None = None


class AlignCTCRequest(BaseModel):
    audio_b64: str
    sr: int
    reference_text: str | None = None
    stage: str = "final"  # "partial" | "final"
    num_chunks: int | None = None  # used when stage=="partial"
    chunk_ms: int = 20  # default 20ms per chunk
    language: str | None = None


class HealthResponse(BaseModel):
    status: str
    models_loaded: dict[str, bool]


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    try:
        # Check if models are loaded
        wav2vec2_processor, wav2vec2_model = extensions.get_wav2vec2_ctc()
        whisper_model = extensions.get_whisper_tiny("auto")

        return HealthResponse(
            status="healthy",
            models_loaded={
                "wav2vec2": wav2vec2_processor is not None
                and wav2vec2_model is not None,
                "whisper": whisper_model is not None,
            },
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.post("/transcribe", response_model=TranscriptResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(..., description="Audio file to transcribe"),
    reference_text: str | None = Form(
        None, description="Reference text for CTC alignment (optional)"
    ),
) -> TranscriptResponse:
    """
    Transcribe audio file and optionally align with reference text using CTC.

    - **audio_file**: Audio file (WAV, MP3, etc.)
    - **reference_text**: Optional reference text for CTC alignment
    """
    try:
        # Validate file type
        if not audio_file.content_type or not audio_file.content_type.startswith(
            "audio/"
        ):
            raise HTTPException(status_code=400, detail="File must be an audio file")

        # Read audio file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
            temp_file.flush()

            try:
                # Load audio with soundfile
                audio_data, sample_rate = sf.read(temp_file.name)

                # Convert to float32 if needed
                if audio_data.dtype != np.float32:
                    audio_data = audio_data.astype(np.float32)

                # Handle stereo audio by converting to mono
                if audio_data.ndim > 1:
                    audio_data = np.mean(audio_data, axis=1)

                logger.info(
                    f"Loaded audio: {len(audio_data)} samples at {sample_rate} Hz"
                )

                # Transcribe and align
                transcript = align_audio(audio_data, sample_rate, reference_text, language=None)

                # Convert to response format
                words_data: list[dict[str, int | str]] = [
                    {
                        "start_ms": int(word.start_ms),
                        "end_ms": int(word.end_ms),
                        "text": str(word.text),
                    }
                    for word in transcript.words
                ]

                # Only return audio if we didn't receive valid audio frames
                # (e.g., when we generate audio via TTS synthesis)
                audio_b64 = None
                if len(audio_data) == 0:
                    # No valid audio received - could generate audio here in the future
                    # For now, return None since we don't generate audio
                    pass
                return TranscriptResponse(text=transcript.text, words=words_data, audio_b64=audio_b64)

            finally:
                # Clean up temp file
                Path(temp_file.name).unlink(missing_ok=True)

    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/align", response_model=TranscriptResponse)
async def align_audio_with_text(
    audio_file: UploadFile = File(..., description="Audio file to align"),
    reference_text: str = Form(..., description="Reference text for alignment"),
) -> TranscriptResponse:
    """
    Align audio with reference text using CTC segmentation.

    - **audio_file**: Audio file (WAV, MP3, etc.)
    - **reference_text**: Reference text to align with audio
    """
    if not reference_text.strip():
        raise HTTPException(status_code=400, detail="Reference text cannot be empty")

    return await transcribe_audio(audio_file, reference_text)


@app.post("/align_ctc", response_model=TranscriptResponse)
async def align_ctc_json(req: AlignCTCRequest) -> TranscriptResponse:
    """JSON-based CTC alignment with optional stage and chunk controls.

    - audio_b64: base64-encoded PCM float32 mono or PCM16 bytes
    - sr: sampling rate of provided audio
    - reference_text: text to align
    - stage: "partial" or "final"
    - num_chunks: when stage=="partial", number of chunks to include
    - chunk_ms: chunk duration in milliseconds (default 20ms)
    """
    import base64

    import numpy as np  # type: ignore

    def _try_decode(raw: bytes) -> "np.ndarray":
        # Try float32 in [-1,1]
        if len(raw) % 4 == 0:
            x_f32 = np.frombuffer(raw, dtype=np.float32)
            if np.isfinite(x_f32).all() and (np.abs(x_f32) <= 1.001).all():
                return x_f32.astype(np.float32)
        # Fallback int16 → float32[-1,1]
        return (np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0)

    try:
        # Decode audio
        raw = base64.b64decode(req.audio_b64)
        x = _try_decode(raw)

        x = x.astype(np.float32)
        sr = int(req.sr)

        # If partial, truncate to num_chunks * chunk_ms
        if (req.stage or "final").lower() == "partial" and int(req.num_chunks or 0) > 0:
            chunk_ms = int(req.chunk_ms or 20)
            samples_per_chunk = max(1, int(round(sr * (chunk_ms / 1000.0))))
            limit = int(req.num_chunks or 0) * samples_per_chunk
            if x.size > limit:
                x = x[:limit]

        # Align (optional reference_text: if empty/None, Whisper will be used)
        tr = align_audio(x, sr, reference_text=req.reference_text, language=req.language)
        words_data: list[dict[str, int | str]] = [
            {"start_ms": int(w.start_ms), "end_ms": int(w.end_ms), "text": str(w.text)}
            for w in tr.words
        ]
        # print(f"words_data: {words_data}")
        # Only return audio if we didn't receive valid audio frames
        # (e.g., when we generate audio via TTS synthesis)
        audio_b64 = None
        if x.size == 0:
            # No valid audio received - could generate audio here in the future
            # For now, return None since we don't generate audio
            pass
        return TranscriptResponse(text=tr.text, words=words_data, audio_b64=audio_b64)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"/align_ctc failed: {e}")
        raise HTTPException(status_code=500, detail=f"alignment failed: {str(e)}")


@app.get("/")
async def root() -> dict[str, str | dict[str, str]]:
    """Root endpoint with API information."""
    return {
        "message": "LearnLoop Model Service",
        "version": "0.1.0",
        "endpoints": {
            "health": "/health",
            "transcribe": "/transcribe",
            "align": "/align",
            "docs": "/docs",
        },
    }

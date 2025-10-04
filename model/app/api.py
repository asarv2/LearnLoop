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
from .transcripts import align_audio, align_ctc  # type: ignore

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
    sample_rate: int | None = None
    encoding: str | None = None  # "f32le" or "s16le"


class AlignCTCRequest(BaseModel):
    audio_b64: str
    sr: int
    reference_text: str | None = None
    stage: str = "final"  # "partial" | "final"
    num_chunks: int | None = None  # used when stage=="partial"
    chunk_ms: int = 20  # default 20ms per chunk
    language: str | None = None
    reference_audio_b64: str | None = None  # NEW: Reference audio for better alignment


class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"
    sample_rate: int = 48000


class TTSResponse(BaseModel):
    audio_b64: str
    sample_rate: int
    duration_ms: int


class HealthResponse(BaseModel):
    status: str
    models_loaded: dict[str, bool]
    device: str | None = None


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    try:
        # Check if models are loaded
        wav2vec2_processor, wav2vec2_model = extensions.get_wav2vec2_ctc()
        whisper_model = extensions.get_whisper_tiny("auto")
        kokoro_model = extensions.get_kokoro_pipeline("a")
        cb_en = extensions.get_chatterbox_tts()
        
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else \
                     ("mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else "cpu")
        except Exception:
            device = None

        return HealthResponse(
            status="healthy",
            models_loaded={
                "wav2vec2": bool(wav2vec2_processor and wav2vec2_model),
                "whisper": whisper_model is not None,
                "kokoro": kokoro_model is not None,
                "chatterbox_en": cb_en is not None,
            },
            device=device,
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@app.get("/ready")
async def ready() -> dict[str, bool]:
    """Lightweight readiness probe for containers/compose."""
    ok = extensions.get_whisper_tiny("auto") is not None and extensions.get_kokoro_pipeline("a") is not None
    return {"ready": ok}


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

        # Read audio file directly from memory
        import io
        content = await audio_file.read()
        with io.BytesIO(content) as bio:
            audio_data, sample_rate = sf.read(bio, dtype="float32", always_2d=False)

        # Handle stereo audio by converting to mono
        if audio_data.ndim > 1:
            audio_data = audio_data.mean(axis=1)

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
    import time
    start_time = time.time()
    logger.info(f"[align_ctc] request: stage={req.stage} sr={req.sr} ref_text_len={len(req.reference_text or '')} ref_text='{req.reference_text[:100] if req.reference_text else None}...' audio_b64_len={len(req.audio_b64)} ref_audio_b64_len={len(req.reference_audio_b64) if req.reference_audio_b64 else 0}")
    import base64

    import numpy as np  # type: ignore

    def _decode_audio(raw: bytes) -> tuple["np.ndarray", int | None]:
        """Decode base64 payload into mono float32 samples and detect sample rate."""
        import io

        try:
            with io.BytesIO(raw) as bio:
                audio, sr_detected = sf.read(bio, dtype="float32")
            if audio.ndim > 1:
                audio = np.mean(audio, axis=1)
            return audio.astype(np.float32, copy=False), int(sr_detected)
        except Exception:
            pass

        if len(raw) % 4 == 0:
            x_f32 = np.frombuffer(raw, dtype=np.float32)
            if np.isfinite(x_f32).all():
                mx = float(np.max(np.abs(x_f32))) if x_f32.size else 0.0
                if 0.0 < mx <= 1.001:
                    return x_f32.astype(np.float32, copy=False), None

        x_i16 = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return x_i16, None

    try:
        # Decode audio
        raw = base64.b64decode(req.audio_b64)
        x, _ = _decode_audio(raw)

        x = x.astype(np.float32)
        sr = int(req.sr)

        # NEW: Handle reference audio if provided
        ref_audio = None
        ref_audio_sr: int | None = None
        if req.reference_audio_b64:
            try:
                ref_raw = base64.b64decode(req.reference_audio_b64)
                ref_audio, ref_audio_sr = _decode_audio(ref_raw)
                ref_audio = ref_audio.astype(np.float32)
                # Use reference audio for better alignment
                # This could involve cross-correlation or other alignment techniques
                logger.info(
                    f"Using reference audio for alignment: {len(ref_audio)} samples sr={ref_audio_sr or 'unknown'}"
                )
            except Exception as e:
                logger.warning(f"Failed to decode reference audio: {e}")
                ref_audio = None
                ref_audio_sr = None

        # If partial, truncate to num_chunks * chunk_ms
        if (req.stage or "final").lower() == "partial" and int(req.num_chunks or 0) > 0:
            chunk_ms = int(req.chunk_ms or 20)
            samples_per_chunk = max(1, int(round(sr * (chunk_ms / 1000.0))))
            limit = int(req.num_chunks or 0) * samples_per_chunk
            if x.size > limit:
                x = x[:limit]

        # Only return audio if we didn't receive valid audio frames
        audio_b64: str | None = None
        sample_rate: int | None = None
        encoding: str | None = None
        if x.size == 0 and req.reference_text:
            # No valid audio received - generate audio using unified TTS FIRST
            try:
                audio_data, sample_rate = extensions.synthesize_tts(
                    text=req.reference_text,
                    sr=48000,
                    language=req.language,
                    reference_audio=(ref_audio if req.reference_audio_b64 else None),
                    reference_audio_sr=ref_audio_sr,
                )
                if audio_data.size > 0:
                    # NOW align using the generated audio (skip Whisper since we have reference text)
                    tr = align_ctc(audio_data, sample_rate, req.reference_text)
                    
                    # Encode generated audio for return
                    audio_bytes = audio_data.astype(np.float32).tobytes()
                    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
                    sample_rate = 48000
                    encoding = "f32le"
                else:
                    # Generated audio is empty, fallback to original behavior
                    tr = align_audio(x, sr, reference_text=req.reference_text, language=req.language)
            except Exception as e:
                logger.warning(f"Failed to generate TTS audio: {e}")
                # Fallback to original behavior
                tr = align_audio(x, sr, reference_text=req.reference_text, language=req.language)
        else:
            # Normal case: align with provided audio
            tr = align_audio(x, sr, reference_text=req.reference_text, language=req.language)

        words_data: list[dict[str, int | str]] = [
            {"start_ms": int(w.start_ms), "end_ms": int(w.end_ms), "text": str(w.text)}
            for w in tr.words
        ]
        # print(f"words_data: {words_data}")
        
        # Log total align_ctc timing
        elapsed = time.time() - start_time
        logger.info(f"[ALIGN-TIMING] Total: {elapsed:.3f}s (stage={req.stage}, audio_len={x.size})")
        
        return TranscriptResponse(
            text=tr.text, 
            words=words_data, 
            audio_b64=audio_b64,
            sample_rate=sample_rate,
            encoding=encoding
        )
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
            "ready": "/ready",
            "transcribe": "/transcribe",
            "align": "/align",
            "docs": "/docs",
        },
    }

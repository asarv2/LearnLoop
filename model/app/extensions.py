from __future__ import annotations

import logging
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf  # type: ignore

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
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
    )

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
def get_wav2vec2_ctc() -> tuple[Any, Any]:
    try:
        from transformers import Wav2Vec2ForCTC  # type: ignore
        from transformers import Wav2Vec2Processor

        model_name = "facebook/wav2vec2-base-960h"
        cache_dir = str(MODEL_CACHE_DIR / "wav2vec2")

        proc = Wav2Vec2Processor.from_pretrained(model_name, cache_dir=cache_dir)
        mdl = Wav2Vec2ForCTC.from_pretrained(model_name, cache_dir=cache_dir).eval()
        
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        try:
            mdl.to(device)
        except Exception:
            pass
        
        logger.info(
            f"Initialized Wav2Vec2ForCTC and Wav2Vec2Processor ({model_name}) on {device} - cached in {cache_dir}"
        )
        return proc, mdl
    except Exception as e:
        logger.warning(f"Wav2Vec2 warm load failed: {e}")
        return None, None


@lru_cache(maxsize=1)
def get_whisper_tiny(device_hint: str = "auto") -> Any:
    try:
        import os

        import ctranslate2  # type: ignore
        from faster_whisper import WhisperModel  # type: ignore

        env_device = os.getenv("WHISPER_DEVICE")
        if env_device in ("cpu", "cuda"):
            device_hint = env_device

        has_cuda = getattr(ctranslate2, "get_cuda_device_count", lambda: 0)() > 0
        device = "cuda" if (device_hint != "cpu" and has_cuda) else "cpu"

        # CPU = int8, many threads; GPU = float16
        compute_type = "float16" if device == "cuda" else "int8"
        cpu_threads = os.cpu_count() or 4

        cache_dir = str(MODEL_CACHE_DIR / "whisper")
        model = WhisperModel(
            "tiny", device=device, compute_type=compute_type,
            download_root=cache_dir, cpu_threads=cpu_threads
        )
        logger.info(f"Whisper init device={device} compute={compute_type} cpu_threads={cpu_threads}")
        return model
    except Exception as e:
        logger.warning(f"Whisper warm load failed: {e}")
        return None


# ---------- TTS (Kokoro) ----------

# Optional: map your abstract voice names to Kokoro voices
VOICE_MAP = {
    "alloy": "af_heart",
}

# ---------- TTS (Chatterbox) ----------

@lru_cache(maxsize=1)
def get_chatterbox_tts() -> Any:
    """Load English Chatterbox TTS on CUDA (no CPU fallback)."""
    try:
        import torch
        if not torch.cuda.is_available():
            logger.info("ChatterboxTTS skipped: CUDA not available")
            return None
        from chatterbox.tts import ChatterboxTTS  # type: ignore

        torch.backends.cudnn.benchmark = True
        torch.set_float32_matmul_precision("high")  # favor tensor cores

        mdl = ChatterboxTTS.from_pretrained(device="cuda").eval()
        try:
            mdl.half()  # FP16 weights if supported
        except Exception:
            pass
        logger.info("Initialized ChatterboxTTS on CUDA (fp16-ready)")
        return mdl
    except Exception as e:
        logger.warning(f"ChatterboxTTS load failed: {e}")
        return None

@lru_cache(maxsize=1)
def get_chatterbox_multilingual() -> Any:
    """Load Multilingual Chatterbox TTS on CUDA (no CPU fallback)."""
    try:
        import torch
        if not torch.cuda.is_available():
            logger.info("ChatterboxMultilingual skipped: CUDA not available")
            return None
        from chatterbox import ChatterboxMultilingualTTS  # type: ignore

        torch.backends.cudnn.benchmark = True
        torch.set_float32_matmul_precision("high")  # favor tensor cores

        mdl = ChatterboxMultilingualTTS.from_pretrained(device="cuda").eval()
        try:
            mdl.half()  # FP16 weights if supported
        except Exception:
            pass
        logger.info("Initialized Chatterbox Multilingual TTS on CUDA (fp16-ready)")
        return mdl
    except Exception as e:
        logger.warning(f"Chatterbox Multilingual load failed: {e}")
        return None

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


def _resample_fast(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    """Fast, high-quality resampling with multiple fallback options."""
    if sr_in == sr_out or x.size == 0:
        return x.astype(np.float32, copy=False)
    try:
        # Fast + great quality if torchaudio is available (uses soxr)
        import torch
        import torchaudio  # type: ignore
        t = torch.from_numpy(x.astype(np.float32)).unsqueeze(0)
        y = torchaudio.functional.resample(t, sr_in, sr_out, rolloff=0.99, lowpass_filter_width=16)
        return y.squeeze(0).contiguous().numpy().astype(np.float32)  # type: ignore
    except Exception:
        try:
            # Very fast polyphase resampler
            from scipy.signal import resample_poly  # type: ignore
            g = np.gcd(sr_in, sr_out)
            up, down = sr_out // g, sr_in // g
            return resample_poly(x.astype(np.float32), up, down).astype(np.float32)  # type: ignore
        except Exception:
            # Last resort
            ratio = sr_out / float(sr_in)
            n_out = max(1, int(round(x.size * ratio)))
            xi = np.arange(x.size, dtype=np.float32)
            idx = np.linspace(0, x.size - 1, num=n_out, dtype=np.float32)
            return np.interp(idx, xi, x).astype(np.float32)


def synthesize_kokoro(text: str, voice: str = "alloy", sr: int = 48000) -> tuple[np.ndarray, int]:
    """
    Generate speech with Kokoro at 24 kHz, then resample to target sample rate.
    Uses parallel synthesis for long text.
    
    Args:
        text: Text to synthesize
        voice: Voice name (default: "alloy")
        sr: Target sample rate (default: 48000)
    
    Returns:
        Tuple of (audio_data, sample_rate)
    """
    try:
        from concurrent.futures import ThreadPoolExecutor
        
        pipeline = get_kokoro_pipeline(lang_code="a")
        if pipeline is None:
            raise RuntimeError("Kokoro pipeline not available")

        kokoro_voice = VOICE_MAP.get(voice, voice)
        
        # Split text into sentences for parallel processing
        import re
        seqs = re.split(r'[.!?]\s+', text)
        seqs = [s.strip() for s in seqs if s.strip()]
        
        if not seqs:
            # fallback to original generator path
            gen = pipeline(text, voice=kokoro_voice, speed=1.0, split_pattern=r"\n+")  # type: ignore
            chunks = [np.asarray(a, np.float32) for _,_,a in gen]
        else:
            def _do(s: str) -> np.ndarray:
                g = pipeline(s, voice=kokoro_voice, speed=1.0, split_pattern=r"\n+")  # type: ignore
                buf = []
                for *_, a in g:
                    buf.append(np.asarray(a, np.float32))
                return np.concatenate(buf) if buf else np.zeros(0, np.float32)

            # Small pool — more doesn't always help on CPU
            with ThreadPoolExecutor(max_workers=min(4, (os.cpu_count() or 4))) as ex:
                chunks = list(ex.map(_do, seqs))

        if not chunks:
            return np.zeros(0, dtype=np.float32), sr

        y24 = np.concatenate(chunks, axis=0).astype(np.float32)
        y = _resample_fast(y24, 24000, sr)
        return y, sr
    except Exception as e:
        logger.warning(f"Kokoro synthesis failed: {e}")
        # Fallback: generate silence with a tone
        dur_s = max(0.4, min(8.0, len(text.split()) * 0.35))
        n = int(round(dur_s * sr))
        t = np.arange(n, dtype=np.float32) / float(sr)
        y = (0.05 * np.sin(2 * np.pi * 220.0 * t)).astype(np.float32)
        return y, sr


def synthesize_tts(
    text: str,
    *,
    sr: int = 48000,
    language: str | None = None,
    prefer_multilingual: bool = False,
    reference_audio: np.ndarray | None = None,
) -> tuple[np.ndarray, int]:
    """
    Prefer Chatterbox on CUDA; if a reference clip is provided, do zero-shot voice cloning.
    Fallback to Kokoro on CPU. Returns (float32 mono PCM, sample_rate).
    """
    try:
        import torch
        if torch.cuda.is_available():
            # 1) Pick model (EN or multilingual)
            mdl = get_chatterbox_multilingual() if prefer_multilingual else get_chatterbox_tts()
            if mdl is None:
                mdl = get_chatterbox_tts() if prefer_multilingual else get_chatterbox_multilingual()
            if mdl is not None:
                sr_native = getattr(mdl, "sr", 24000)
                gen_kwargs = {}
                
                # multilingual API uses language_id (per README)
                if language and mdl.__class__.__name__.lower().startswith("chatterboxmultilingual"):
                    gen_kwargs["language_id"] = language  # e.g., "en", "fr", "ja"

                # 2) If we have a reference clip, write it to a temp wav and pass audio_prompt_path
                audio_prompt_path = None
                if reference_audio is not None and reference_audio.size > 0:
                    with tempfile.TemporaryDirectory() as td:
                        # If your ref clip isn't already at sr_native, resample before saving
                        ref = reference_audio.astype(np.float32).reshape(-1)
                        if sr != sr_native:
                            ref = _resample_fast(ref, sr_in=sr, sr_out=sr_native)
                        audio_prompt_path = os.path.join(td, "ref.wav")
                        sf.write(audio_prompt_path, ref, sr_native, subtype="PCM_16")
                        gen_kwargs["audio_prompt_path"] = audio_prompt_path  # <- cloning!

                        if torch.cuda.is_available():
                            stream = torch.cuda.current_stream()
                            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                                wav = mdl.generate(text, **gen_kwargs)
                            torch.cuda.synchronize()  # ensure completion before returning
                        else:
                            wav = mdl.generate(text, **gen_kwargs)
                else:
                    if torch.cuda.is_available():
                        stream = torch.cuda.current_stream()
                        with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                            wav = mdl.generate(text, **gen_kwargs)
                        torch.cuda.synchronize()  # ensure completion before returning
                    else:
                        wav = mdl.generate(text, **gen_kwargs)

                y = wav.squeeze().detach().cpu().numpy().astype(np.float32)
                if sr != sr_native:
                    y = _resample_fast(y, sr_native, sr)
                return y, sr
    except Exception as e:
        logger.warning(f"synthesize_tts: Chatterbox path failed (clone or base). Falling back. err={e}")

    # 3) CPU fallback
    return synthesize_kokoro(text=text, voice="alloy", sr=sr)


def _pin_cpu_threads(n: int | None = None) -> None:
    """Pin CPU threads for optimal performance."""
    import torch
    n = n or (os.cpu_count() or 4)
    torch.set_num_threads(n)
    for k in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ[k] = str(n)


def warm_all_models() -> None:
    """Warm up all models for faster first inference."""
    # Pin CPU threads once at startup
    _pin_cpu_threads()
    
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
        get_chatterbox_tts()
    except Exception:
        pass
    try:
        get_chatterbox_multilingual()
    except Exception:
        pass

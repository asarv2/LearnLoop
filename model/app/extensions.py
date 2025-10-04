from __future__ import annotations

import hashlib  # For reference audio caching
import logging
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any


# --- set threads early ---
def _pin_cpu_threads(n: int | None = None) -> None:
    """Pin CPU threads for optimal performance."""
    n = n or (os.cpu_count() or 4)
    for k in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
        os.environ.setdefault(k, str(n))

_pin_cpu_threads()

# now import numpy/torch/etc.
import numpy as np
import soundfile as sf  # type: ignore

# Import torch for type checking
try:
    import torch  # type: ignore
except ImportError:
    torch = None  # type: ignore

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

import re
# Suppress benign CTC warning from transformers
import warnings

warnings.filterwarnings("ignore", message=".*masked_spec_embed.*")
warnings.filterwarnings(
    "ignore",
    message=r"dropout .* num_layers greater than 1"
)
warnings.filterwarnings(
    "ignore",
    message=r"torch\.nn\.utils\.weight_norm is deprecated"
)

# Suppress transformers verbosity for cleaner logs
try:
    from transformers.utils.logging import set_verbosity  # type: ignore

    set_verbosity(40)  # ERROR level
except ImportError:
    pass

BASE = Path(__file__).resolve().parents[1]
MODEL_CACHE_DIR = BASE / "model_cache"

MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ---------- Global CUDA optimizations ----------
def _enable_cuda_fast_paths() -> None:
    """Enable CUDA fast paths globally for RTX 3060 (Ampere architecture)."""
    try:
        import torch
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True  # autotune fastest conv algo
        torch.set_float32_matmul_precision("high")  # enables TF32 on Ampere+
    except Exception:
        pass

# Enable CUDA optimizations early
_enable_cuda_fast_paths()


def _pick_torch_device() -> str:
    """Pick the best available PyTorch device."""
    import torch
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


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
        
        device = _pick_torch_device()
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


# ---------- Reference audio caching ----------
_REF_CACHE: dict[str, str] = {}  # key: sha1 of raw ref audio bytes -> path to tmp wav

def _cache_ref_wav(reference_audio: np.ndarray, src_sr: int, native_sr: int) -> str:
    """Cache reference audio to avoid re-deriving embeddings."""
    key = hashlib.sha1(reference_audio.tobytes()).hexdigest()
    if key in _REF_CACHE:
        return _REF_CACHE[key]
    x = reference_audio.astype(np.float32).reshape(-1)
    if src_sr != native_sr:
        x = _resample_fast(x, src_sr, native_sr)
    td = tempfile.gettempdir()
    outp = os.path.join(td, f"ref-{key}.wav")
    if not os.path.exists(outp):
        sf.write(outp, x, native_sr, subtype="PCM_16")
    _REF_CACHE[key] = outp
    return outp


# ---------- Audio format normalization ----------
def _to_pcm_f32(arr: "np.ndarray | list | torch.Tensor") -> np.ndarray:
    """Normalize any audio array to float32 in [-1, 1] range."""
    import numpy as np
    try:
        import torch  # type: ignore
        if hasattr(arr, "detach"):  # torch.Tensor
            arr = arr.detach().cpu().numpy()
    except Exception:
        pass

    x = np.asarray(arr)
    
    # Squeeze any extra dimensions (handles [1, N] or [N, 1] cases)
    if x.ndim > 1:
        x = x.squeeze()
    
    # If it's integer, normalize to [-1, 1]
    if np.issubdtype(x.dtype, np.integer):
        # int16 is most common; if not sure, divide by the max possible magnitude
        max_mag = np.iinfo(x.dtype).max
        x = x.astype(np.float32) / float(max_mag)
    else:
        x = x.astype(np.float32)

    # If someone handed us float32 but in int16-scale, detect and fix
    mx = float(np.max(np.abs(x))) if x.size else 0.0
    if mx > 1.5:  # clearly not normalized
        # More robust detection: if it's really large, it's likely int16-scaled
        x = (x / (32768.0 if mx < 40000.0 else mx)).astype(np.float32)
    
    # Check for NaN/Inf values and replace
    x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)

    # Safety clamp
    return np.clip(x, -1.0, 1.0).astype(np.float32)


def _dbg_once(name: str, x: np.ndarray) -> None:
    """One-shot debug logging for audio format verification."""
    if getattr(_dbg_once, name, False):
        return
    setattr(_dbg_once, name, True)
    import numpy as np
    mx = float(np.max(np.abs(x))) if x.size else 0.0
    logger.info(f"[audio-check] {name}: dtype={x.dtype} max|x|={mx:.3f} len={x.size}")


# ---------- Declick guard ----------
def _declick_guard(y: np.ndarray, sr_native: int) -> np.ndarray:
    """Remove static/pops with 2ms ramp + clamp."""
    y = np.asarray(y, np.float32).reshape(-1)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
    # 2 ms fade-in/out to avoid clicks
    N = max(1, int(0.002 * sr_native))
    if y.size >= 2*N:
        ramp = np.linspace(0.0, 1.0, N, dtype=np.float32)
        y[:N] *= ramp
        y[-N:] *= ramp[::-1]
    # mild limiter
    return np.clip(y, -1.0, 1.0)


# ---------- TTS (Kokoro) ----------

# Optional: map your abstract voice names to Kokoro voices
VOICE_MAP = {
    "alloy": "af_heart",
}

# ---------- TTS (Chatterbox) ----------

# ---------- helpers ----------
def _maybe_eval(model: object) -> object:
    try:
        import torch.nn as nn  # type: ignore
        if isinstance(model, nn.Module):
            model.eval()
    except Exception:
        pass
    return model

def _maybe_half(model: object) -> None:
    try:
        import torch
        import torch.nn as nn  # type: ignore
        if isinstance(model, nn.Module):
            try:
                model.half()
            except Exception:
                pass
    except Exception:
        pass

def _maybe_to_cuda(model: object) -> object:
    """Try to put model on CUDA if it supports .to() and CUDA is available."""
    try:
        import torch  # type: ignore
        if torch.cuda.is_available() and hasattr(model, "to"):
            model = model.to("cuda")  # type: ignore[attr-defined]
    except Exception:
        pass
    return model

@lru_cache(maxsize=1)
def get_chatterbox_tts() -> Any:
    """Load English Chatterbox TTS on CUDA when possible; tolerate API variants."""
    try:
        import torch  # type: ignore
        if not torch.cuda.is_available():
            logger.info("ChatterboxTTS skipped: CUDA not available")
            return None

        # Import path can differ across releases
        try:
            from chatterbox.tts import ChatterboxTTS  # type: ignore
        except Exception:
            from chatterbox import ChatterboxTTS  # type: ignore

        # Some versions accept device=..., some don't
        try:
            mdl = ChatterboxTTS.from_pretrained(device="cuda")
        except TypeError:
            mdl = ChatterboxTTS.from_pretrained()
            mdl = _maybe_to_cuda(mdl)

        _maybe_eval(mdl)
        _maybe_half(mdl)

        logger.info("Initialized ChatterboxTTS (CUDA-ready)")
        return mdl
    except Exception as e:
        logger.warning(f"ChatterboxTTS load failed (tolerated): {e}")
        return None

@lru_cache(maxsize=1)
def get_chatterbox_multilingual() -> Any:
    """Load Multilingual Chatterbox; tolerate import / API differences."""
    try:
        import torch  # type: ignore
        if not torch.cuda.is_available():
            logger.info("ChatterboxMultilingual skipped: CUDA not available")
            return None

        # Import path can differ
        try:
            from chatterbox.multilingual import \
                ChatterboxMultilingualTTS  # type: ignore
        except Exception:
            from chatterbox import ChatterboxMultilingualTTS  # type: ignore

        try:
            mdl = ChatterboxMultilingualTTS.from_pretrained(device="cuda")
        except TypeError:
            mdl = ChatterboxMultilingualTTS.from_pretrained()
            mdl = _maybe_to_cuda(mdl)

        _maybe_eval(mdl)
        _maybe_half(mdl)

        logger.info("Initialized ChatterboxMultilingualTTS (CUDA-ready)")
        return mdl
    except Exception as e:
        logger.warning(f"Chatterbox Multilingual load failed (tolerated): {e}")
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
        
        # DEBUG: Log raw Kokoro output
        raw_max_kokoro = float(np.max(np.abs(y24))) if y24.size else 0.0
        logger.info(f"[kokoro-raw] max|x|={raw_max_kokoro:.3f} len={y24.size}")
        
        y24 = _to_pcm_f32(y24)  # normalize to [-1, 1]
        _dbg_once("kokoro_out", y24)  # debug logging
        
        # DEBUG: Log after normalization
        norm_max_kokoro = float(np.max(np.abs(y24))) if y24.size else 0.0
        logger.info(f"[kokoro-normalized] max|x|={norm_max_kokoro:.3f} len={y24.size}")
        
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
    Optimized TTS with fast Chatterbox mode, reference caching, and declick guard.
    Prefer English Chatterbox for English text; fallback to Kokoro on CPU.
    Returns (float32 mono PCM, sample_rate).
    """
    try:
        import torch
        if torch.cuda.is_available():
            # 1) Pick model (prefer English for English text)
            is_english = language is None or language.lower() in ('en', 'english')
            if is_english and not prefer_multilingual:
                mdl = get_chatterbox_tts()  # English model is faster
            else:
                mdl = get_chatterbox_multilingual() if prefer_multilingual else get_chatterbox_tts()
                if mdl is None:
                    mdl = get_chatterbox_tts() if prefer_multilingual else get_chatterbox_multilingual()
            
            if mdl is not None:
                sr_native = getattr(mdl, "sr", 24000)
                
                # 2) Reference audio caching (avoid re-deriving embeddings)
                if reference_audio is not None and reference_audio.size > 0:
                    audio_prompt_path = _cache_ref_wav(reference_audio, sr, sr_native)
                    # Note: Chatterbox may not support audio_prompt_path parameter
                    # We'll try it but fall back to text-only if it fails
                    try:
                        # 3) Fast generation with CUDA optimizations
                        if torch.cuda.is_available():
                            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                                wav = mdl.generate(text, audio_prompt_path=audio_prompt_path)
                            torch.cuda.synchronize()
                        else:
                            with torch.inference_mode():
                                wav = mdl.generate(text, audio_prompt_path=audio_prompt_path)
                    except TypeError:
                        # Fallback to text-only generation
                        if torch.cuda.is_available():
                            with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                                wav = mdl.generate(text)
                            torch.cuda.synchronize()
                        else:
                            with torch.inference_mode():
                                wav = mdl.generate(text)
                else:
                    # 3) Fast generation with CUDA optimizations (text-only)
                    if torch.cuda.is_available():
                        with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
                            wav = mdl.generate(text)
                        torch.cuda.synchronize()
                    else:
                        with torch.inference_mode():
                            wav = mdl.generate(text)

                # Handle both torch tensors and numpy arrays from model.generate()
                y_raw = wav  # could be tensor, np array, or list
                
                # DEBUG: Log raw output before normalization
                try:
                    import numpy as np
                    if hasattr(y_raw, "detach"):
                        temp = y_raw.detach().cpu().numpy()
                    else:
                        temp = np.asarray(y_raw)
                    raw_max = float(np.max(np.abs(temp))) if temp.size else 0.0
                    raw_dtype = temp.dtype
                    logger.info(f"[chatterbox-raw] dtype={raw_dtype} max|x|={raw_max:.3f} len={temp.size}")
                except Exception:
                    pass
                
                y = _to_pcm_f32(y_raw)  # << normalize here
                _dbg_once("tts_out", y)  # debug logging
                
                # DEBUG: Log after normalization
                norm_max = float(np.max(np.abs(y))) if y.size else 0.0
                logger.info(f"[chatterbox-normalized] max|x|={norm_max:.3f} len={y.size}")
                
                y = _declick_guard(y, sr_native)
                
                # 5) Keep native SR until final resample
                if sr != sr_native:
                    y = _resample_fast(y, sr_native, sr)
                return y, sr
    except Exception as e:
        logger.warning(f"synthesize_tts: Chatterbox path failed (clone or base). Falling back. err={e}")

    # 6) CPU fallback
    return synthesize_kokoro(text=text, voice="alloy", sr=sr)


def warm_all_models() -> None:
    """Warm up all models for faster first inference."""
    # Set torch threads (env vars already set at module level)
    try:
        import torch
        torch.set_num_threads(os.cpu_count() or 4)
    except Exception:
        pass
    
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

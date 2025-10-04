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

        # Optimize compute type for best latency/accuracy trade on Ampere
        compute_type = "int8_float16" if device == "cuda" else "int8"
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

# ---------- GPU Keep-alive for performance ----------
_LAST_GENERATION_TIME = 0.0

def _gpu_keepalive() -> None:
    """Send a tiny GEMM operation to keep GPU warm and prevent downclocking."""
    try:
        import time

        import torch
        global _LAST_GENERATION_TIME
        
        current_time = time.time()
        # Only do keep-alive every 30 seconds
        if current_time - _LAST_GENERATION_TIME > 30.0:
            if torch.cuda.is_available():
                # Tiny GEMM to wake tensor cores more reliably than zero allocate+sync
                a = torch.randn(256, 256, device="cuda", dtype=torch.float16)
                b = torch.randn(256, 256, device="cuda", dtype=torch.float16)
                (a @ b).norm()  # tiny matmul; no need to sync
                _LAST_GENERATION_TIME = current_time
                logger.debug("GPU keep-alive GEMM sent")
    except Exception:
        pass

def _cache_ref_wav(
    reference_audio: np.ndarray,
    src_sr: int | None,
    native_sr: int,
) -> str:
    """Cache reference audio to avoid re-deriving embeddings.

    Args:
        reference_audio: PCM float32 mono samples.
        src_sr: Original sample rate of ``reference_audio``.  If ``None`` we
            assume it's already at ``native_sr``.
        native_sr: Sample rate required by the downstream model.
    """
    key = hashlib.sha1(reference_audio.tobytes()).hexdigest()
    if key in _REF_CACHE:
        return _REF_CACHE[key]
    x = reference_audio.astype(np.float32).reshape(-1)
    src_sr = int(src_sr) if src_sr else native_sr
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

# ---------- Fast Chatterbox Proxy for Performance Optimization ----------

import functools
import threading
from typing import Optional

# 1) Optimize Chatterbox T3 performance with monkey-patches
try:
    import chatterbox.models.t3.t3 as t3mod  # type: ignore

    # Fix tqdm to handle iterable correctly (Chatterbox calls tqdm(range(...), ...))
    t3mod.tqdm = lambda iterable, **k: iterable  # just pass through the iterable
    logger.info("Applied tqdm no-op for chatterbox T3")
    
    # Force max_new_tokens cap instead of using setdefault (vendor passes 1000)
    _old_inf = t3mod.T3.inference
    
    def _inference_cap(self, *args, **kw):  # type: ignore
        m = kw.get("max_new_tokens", None)
        # Clamp even if explicitly provided by caller
        kw["max_new_tokens"] = 80 if m is None else min(int(m), 80)
        return _old_inf(self, *args, **kw)
    
    t3mod.T3.inference = _inference_cap
    logger.info("Patched T3.inference to cap max_new_tokens at 80")
except Exception:
    pass

# 2) Optional: Disable watermarking for performance testing
try:
    import perth  # type: ignore
    perth.PerthImplicitWatermarker.apply_watermark = lambda self, wav, sample_rate: wav
    logger.info("Watermarking disabled for performance (test mode)")
except Exception:
    pass

# 3) Optional: Guard against UnboundLocalError in prepare_conditionals
try:
    import chatterbox.tts as cbtts  # type: ignore
    _orig_prep = cbtts.ChatterboxTTS.prepare_conditionals

    def _prep_guard(self, wav_fpath, exaggeration=0.5):  # type: ignore
        try:
            return _orig_prep(self, wav_fpath, exaggeration)
        except NameError as e:
            # Handle missing t3_cond_prompt_tokens when speech_cond_prompt_len is 0/None
            logger.warning(f"prepare_conditionals edge case: {e}. Using fallback.")
            import librosa  # type: ignore
            import torch
            from chatterbox.models.s3gen.s3gen import S3_SR  # type: ignore
            from chatterbox.models.t3.t3 import Conditionals  # type: ignore
            from chatterbox.models.t3.t3 import T3Cond  # type: ignore
            
            s3gen_ref_wav, _ = librosa.load(wav_fpath, sr=self.sr)
            ref_16k_wav = librosa.resample(s3gen_ref_wav, orig_sr=self.sr, target_sr=S3_SR)
            s3gen_ref_wav = s3gen_ref_wav[:getattr(self, 'DEC_COND_LEN', len(s3gen_ref_wav))]
            s3gen_ref_dict = self.s3gen.embed_ref(s3gen_ref_wav, self.sr, device=self.device)
            
            # Create VE embed safely
            if hasattr(self, 've') and hasattr(self.ve, 'embeds_from_wavs'):
                ve_embed = torch.from_numpy(self.ve.embeds_from_wavs([ref_16k_wav], sample_rate=S3_SR)).mean(0, keepdim=True).to(self.device)
            else:
                # Fallback: create a dummy embedding
                ve_embed = torch.zeros(1, 256, device=self.device)
            
            self.conds = Conditionals(T3Cond(
                speaker_emb=ve_embed,
                cond_prompt_speech_tokens=None,  # Explicitly None for edge case
                emotion_adv=exaggeration * torch.ones(1,1,1, device=self.device)
            ).to(device=self.device), s3gen_ref_dict)
            return self.conds
    
    cbtts.ChatterboxTTS.prepare_conditionals = _prep_guard
    logger.info("Patched prepare_conditionals to guard missing prompt tokens")
except Exception:
    pass

class _FastCBProxy:
    """Optimized wrapper around ChatterboxTTS to eliminate major performance bottlenecks."""
    
    def __init__(self, mdl: Any) -> None:
        self._m = mdl
        self.sr = getattr(mdl, "sr", 24000)
        self._cond_cache: dict[tuple[str, float], Any] = {}      # key: (path, round(exag,2)) -> Conditionals
        self._lock = threading.Lock()
        
        # Promote to fp16 for better performance
        try:
            if hasattr(mdl, 't3'):
                mdl.t3.half()
            if hasattr(mdl, 's3gen'):
                mdl.s3gen.half()
            if hasattr(mdl, 'speech_emb'):
                mdl.speech_emb = mdl.speech_emb.half()
            if hasattr(mdl, 'text_emb'):
                mdl.text_emb = mdl.text_emb.half()
        except Exception:
            pass

    def _prepare_conds_cached(self, audio_prompt_path: Optional[str], exaggeration: float) -> None:
        """Cache conditionals to avoid recomputing for the same voice."""
        if not audio_prompt_path:
            assert self._m.conds is not None, "Call once with audio_prompt_path to seed conditionals."
            return
        
        key = (audio_prompt_path, round(float(exaggeration), 2))
        with self._lock:
            hit = self._cond_cache.get(key)
            if hit is None:
                self._m.prepare_conditionals(audio_prompt_path, exaggeration=exaggeration)
                self._cond_cache[key] = self._m.conds  # keep GPU-resident
            else:
                self._m.conds = hit

    def generate(self, text: str, *, audio_prompt_path: Optional[str] = None,
                 exaggeration: float = 0.6, cfg_weight: float = 0.0,
                 temperature: float = 0.8, top_p: float = 0.95, min_p: float = 0.05,
                 repetition_penalty: float = 1.15) -> Any:
        """Generate speech with optimizations: no CFG, cached conditionals, FP16 autocast."""
        # Hard-disable CFG to avoid accidental batch doubling (major speedup)
        cfg_weight = 0.0  # hard-disable to avoid accidental batch=2
        self._prepare_conds_cached(audio_prompt_path, exaggeration)

        import torch
        with torch.inference_mode(), torch.autocast("cuda", dtype=torch.float16):
            # Call the vendor generate but force cfg=0.0 and optimized settings
            return self._m.generate(
                text=text,
                audio_prompt_path=None,          # we already prepared/cached
                exaggeration=exaggeration,
                cfg_weight=cfg_weight,           # 0.0 by default (fast!)
                temperature=temperature,
                top_p=top_p,
                min_p=min_p,
                repetition_penalty=repetition_penalty,
            )

@lru_cache(maxsize=1)
def get_chatterbox_tts() -> Any:
    """Load English Chatterbox TTS on CUDA when possible; return optimized proxy."""
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
        # Note: _maybe_half removed - proxy handles fp16 promotion explicitly

        # Return optimized proxy instead of raw model
        proxy = _FastCBProxy(mdl)
        logger.info("Initialized ChatterboxTTS with Fast Proxy (CUDA-ready)")
        return proxy
    except Exception as e:
        logger.warning(f"ChatterboxTTS load failed (tolerated): {e}")
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
        
        # DEBUG: Log raw Kokoro output (moved to debug to reduce I/O jitter)
        raw_max_kokoro = float(np.max(np.abs(y24))) if y24.size else 0.0
        logger.debug(f"[kokoro-raw] max|x|={raw_max_kokoro:.3f} len={y24.size}")
        
        y24 = _to_pcm_f32(y24)  # normalize to [-1, 1]
        _dbg_once("kokoro_out", y24)  # debug logging
        
        # DEBUG: Log after normalization (moved to debug to reduce I/O jitter)
        norm_max_kokoro = float(np.max(np.abs(y24))) if y24.size else 0.0
        logger.debug(f"[kokoro-normalized] max|x|={norm_max_kokoro:.3f} len={y24.size}")
        
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
    reference_audio: np.ndarray | None = None,
    reference_audio_sr: int | None = None,
) -> tuple[np.ndarray, int]:
    """
    Optimized TTS with Chatterbox mode, reference caching, and declick guard.
    Uses English Chatterbox; fallback to Kokoro on CPU.
    Returns (float32 mono PCM, sample_rate).
    """
    try:
        import torch
        if torch.cuda.is_available():
            # Send GPU keep-alive to prevent downclocking
            _gpu_keepalive()
            
            # Use English Chatterbox model
            mdl = get_chatterbox_tts()
            
            if mdl is not None:
                sr_native = getattr(mdl, "sr", 24000)
                
                # 2) Reference audio caching (avoid re-deriving embeddings)
                if reference_audio is not None and reference_audio.size > 0:
                    audio_prompt_path = _cache_ref_wav(
                        reference_audio,
                        reference_audio_sr if reference_audio_sr else sr,
                        sr_native,
                    )
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
                    logger.debug(f"[chatterbox-raw] dtype={raw_dtype} max|x|={raw_max:.3f} len={temp.size}")
                except Exception:
                    pass
                
                y = _to_pcm_f32(y_raw)  # << normalize here
                _dbg_once("tts_out", y)  # debug logging
                
                # DEBUG: Log after normalization
                norm_max = float(np.max(np.abs(y))) if y.size else 0.0
                logger.debug(f"[chatterbox-normalized] max|x|={norm_max:.3f} len={y.size}")
                
                # CRITICAL FIX: Chatterbox outputs at full scale (0dB), but Kokoro outputs
                # at ~-6 to -8dB. Apply gain reduction to prevent clipping/static when
                # audio is sent to server and potentially mixed/boosted downstream.
                # Target: -6dB headroom (multiply by 0.5)
                y = y * 0.5
                logger.debug(f"[chatterbox-gain-reduced] max|x|={float(np.max(np.abs(y))):.3f} (applied -6dB)")
                
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
    # Cap to 6-8 threads to prevent event loop starvation
    try:
        import torch
        cpu_count = os.cpu_count() or 4
        optimal_threads = min(8, max(4, cpu_count // 2))  # 4-8 threads max
        torch.set_num_threads(optimal_threads)
        logger.info(f"Set torch threads to {optimal_threads} (CPU count: {cpu_count})")
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

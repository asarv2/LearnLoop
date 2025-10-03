from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np

# Lazy imports via functions to avoid optional deps breaking import time
from . import extensions as ext  # type: ignore

# Cache char_list once at module scope
_CHAR_LIST = None


@dataclass
class Word:
    start_ms: int
    end_ms: int
    text: str


@dataclass
class Transcript:
    words: list[Word]
    text: str


def align_words_uniform(
    audio_f32: np.ndarray, sr: int, reference_text: str
) -> Transcript:
    duration_ms = int(round((audio_f32.size / max(1, sr)) * 1000.0))
    words = [w for w in (reference_text or "").split() if w]
    if not words:
        return Transcript(words=[], text=reference_text or "")
    per = max(1, duration_ms // len(words))
    out: list[Word] = []
    t = 0
    for i, w in enumerate(words):
        end = duration_ms if i == len(words) - 1 else min(duration_ms, t + per)
        out.append(Word(start_ms=t, end_ms=end, text=w))
        t = end
    return Transcript(words=out, text=reference_text)


def _to_mono_16k(audio_f32: np.ndarray, sr: int) -> tuple[np.ndarray, int]:
    x = np.asarray(audio_f32, dtype=np.float32)
    # Fold channels to mono if needed
    if x.ndim == 2:
        # assume (channels, samples) if rows < cols, else (samples, channels)
        if x.shape[0] < x.shape[1]:
            x = x.mean(axis=0)
        else:
            x = x.mean(axis=1)
    x = x.reshape(-1)

    if sr <= 0 or x.size == 0:
        return np.zeros(0, dtype=np.float32), 16000

    if sr == 16000:
        return x, 16000

    ratio = 16000.0 / float(sr)
    n_out = max(1, int(round(x.size * ratio)))
    xi = np.arange(x.size, dtype=np.float32)
    idx = np.linspace(0, x.size - 1, num=n_out, dtype=np.float32)
    y = np.interp(idx, xi, x).astype(np.float32)
    return y, 16000


def align_ctc(audio_f32: np.ndarray, sr: int, reference_text: str) -> Transcript:
    try:
        import torch  # type: ignore
        from ctc_segmentation import (  # type: ignore
            CtcSegmentationParameters, ctc_segmentation, prepare_text)

        # Normalize text roughly to wav2vec2's charset
        def _norm_en(s: str) -> str:
            s = s.lower()
            s = re.sub(r"[^a-z' ]+", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            return s

        ref_norm = _norm_en(reference_text or "")
        words = [w for w in ref_norm.split(" ") if w]
        if not words:
            return Transcript(words=[], text=reference_text or "")

        wav16, _ = _to_mono_16k(audio_f32, sr)

        getter = getattr(ext, "get_wav2vec2_ctc", None)
        processor, model = getter() if callable(getter) else (None, None)
        if processor is None or model is None:
            return align_words_uniform(audio_f32, sr, reference_text)

        # Cache char_list once
        global _CHAR_LIST
        if _CHAR_LIST is None:
            vocab = processor.tokenizer.get_vocab()
            cl = [""] * len(vocab)
            for k, v in vocab.items():
                cl[v] = k.replace("|", " ")
            _CHAR_LIST = cl
        char_list = _CHAR_LIST

        import torch
        device = next(model.parameters()).device
        with torch.inference_mode():
            inputs = processor(
                wav16, sampling_rate=16000, return_tensors="pt", padding="longest"
            )
            inp = inputs.input_values.to(device, non_blocking=True)
            if device.type == "cuda":
                with torch.autocast("cuda", dtype=torch.float16):
                    logits = model(inp).logits
            else:
                logits = model(inp).logits
            logits = logits.squeeze(0).float().cpu().numpy()

        params = CtcSegmentationParameters(char_list=char_list)
        ground = prepare_text(params, words)  # per-word alignment
        timings, segments = ctc_segmentation(params, logits, ground)

        # Convert frames to ms using model stride; default to 20ms
        ratio = getattr(
            getattr(model, "config", object()), "inputs_to_logits_ratio", 320
        )
        frame_ms = (float(ratio) / 16000.0) * 1000.0

        out_words: list[Word] = []
        for (start_idx, end_idx), w in zip(segments, words, strict=False):
            start_ms = int(round(start_idx * frame_ms))
            end_ms = int(round(end_idx * frame_ms))
            out_words.append(Word(start_ms=start_ms, end_ms=end_ms, text=w))

        # Log word-level timestamps
        audio_sec = float(len(wav16)) / 16000.0
        sample = ", ".join(
            f"{w.text}({w.start_ms}-{w.end_ms}ms)" for w in out_words[:6]
        )
        import logging

        logging.getLogger("model_service").info(
            "CTC aligned %d words to %.2fs (frame_ms=%.1f). sample: %s",
            len(out_words),
            audio_sec,
            frame_ms,
            sample,
        )
        return Transcript(words=out_words, text=reference_text)
    except Exception:
        return align_words_uniform(audio_f32, sr, reference_text)


def transcribe_and_align_whisper(audio_f32: np.ndarray, sr: int, language: str | None = None) -> Transcript:
    import logging

    log = logging.getLogger("model_service")

    # Guard: require at least ~0.1s of audio and non-NaN values
    if audio_f32 is None or getattr(audio_f32, "size", 0) < max(1, int(0.1 * sr)):
        log.info(
            "Whisper skipped: empty/too-short audio (samples=%d, sr=%d)",
            0 if audio_f32 is None else getattr(audio_f32, "size", 0),
            sr,
        )
        return Transcript(words=[], text="")

    try:
        x16, sro = _to_mono_16k(audio_f32, sr)
        dur_s = float(len(x16)) / sro
        log.info("Whisper input duration: %.3fs @ %d Hz", dur_s, sro)

        get_ws = getattr(ext, "get_whisper_tiny", None)
        model = get_ws("auto") if callable(get_ws) else None
        if model is None:
            log.warning("Whisper model unavailable; returning empty transcript")
            return Transcript(words=[], text="")

        # Direct array (no temp WAV). Fast decode knobs:
        seg_gen, info = model.transcribe(
            x16, language=language,
            vad_filter=True,                    # set False if your audio already trimmed
            vad_parameters={"min_silence_duration_ms": 250},
            word_timestamps=False,              # big saver on CPU
            beam_size=1, best_of=1,             # greedy
            temperature=[0.0],                  # no sampling
            condition_on_previous_text=False,
        )
        
        # Extract full transcript text only
        full_text = " ".join((s.text or "").strip() for s in seg_gen)
        log.info("Whisper transcript: '%s'", full_text[:100] + "..." if len(full_text) > 100 else full_text)
        
        # Always use CTC alignment for word-level precision
        if full_text.strip():
            try:
                ctc_result = align_ctc(audio_f32, sr, full_text)
                log.info("CTC alignment: %d words from transcript", len(ctc_result.words))
                return ctc_result
            except Exception as e:
                log.warning("CTC alignment failed: %s", e)
        
        # Fallback: return transcript without words if CTC fails
        return Transcript(words=[], text=full_text)
    except Exception as e:
        logging.getLogger("model_service").warning(f"Whisper pipeline failed: {e}")
        return Transcript(words=[], text="")


def align_audio(
    audio_f32: np.ndarray, sr: int, reference_text: str | None = None, language: str | None = None
) -> Transcript:
    if reference_text is not None and reference_text.strip():
        return align_ctc(audio_f32, sr, reference_text.strip())
    return transcribe_and_align_whisper(audio_f32, sr, language)

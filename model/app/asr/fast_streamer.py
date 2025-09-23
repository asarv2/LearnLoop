# app/asr/fast_streamer.py
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from faster_whisper import WhisperModel  # type: ignore

SAMPLE_RATE = 16000
INT16_MAX = 32768.0

# Heuristics for "finalizing" text to reduce flicker
MIN_EMIT_INTERVAL_S = 0.5      # how often we compute/emit updates
MIN_FINAL_SILENCE_S = 0.30     # finalize after this much silence
WINDOW_S = 1.5                 # analyze this much audio at a time
HOP_S = 0.5                    # slide forward by this hop
OVERLAP_S = WINDOW_S - HOP_S   # derived

@dataclass
class FinalChunk:
    text: str
    start: float
    end: float
    words: Optional[List[Dict[str, Any]]] = None

class FasterWhisperStreamer:
    """
    Minimal 'streaming' wrapper for faster-whisper:
      - keeps a rolling buffer
      - decodes on a sliding window
      - emits partial text + finalized segments with timestamps
    Notes:
      - This is 'near-realtime' (windowed); for perfect word times, align offline later.
    """
    def __init__(
        self,
        model_name: str = "small.en",
        device: str = "cuda",
        compute_type: Optional[str] = None,
        beam_size: int = 5,
        temperature: float = 0.0,
        word_timestamps_live: bool = True,
    ) -> None:
        if compute_type is None:
            compute_type = "float16" if device == "cuda" else "int8"
        self.model = WhisperModel(model_name, device=device, compute_type=compute_type)

        self.beam_size = beam_size
        self.temperature = temperature
        self.word_ts = word_timestamps_live

        self._buf = np.zeros(0, dtype=np.float32)
        self._last_decode_t = 0.0
        self._audio_time_origin = 0.0  # seconds elapsed fed so far
        self._finalized_until = 0.0    # timeline position we have 'committed' up to
        self._last_speech_time = 0.0
        self._partial_accum = ""       # last partial text we showed

    @property
    def fed_seconds(self) -> float:
        return len(self._buf) / SAMPLE_RATE

    def feed_pcm16(self, pcm_bytes: bytes, sample_rate: int = SAMPLE_RATE) -> None:
        """Append raw s16le mono into the rolling buffer (float32 [-1,1])."""
        if sample_rate != SAMPLE_RATE:
            # In production: resample (soxr/librosa). Assuming 16k input here.
            raise ValueError(f"Expected {SAMPLE_RATE} Hz, got {sample_rate}")
        chunk = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / INT16_MAX
        self._buf = np.concatenate([self._buf, chunk], axis=0)

    def _current_window(self) -> Optional[np.ndarray]:
        """Return the newest WINDOW_S of audio (with overlap if available)."""
        win_len = int(WINDOW_S * SAMPLE_RATE)
        if len(self._buf) < int(0.5 * win_len):
            return None
        if len(self._buf) <= win_len:
            return self._buf
        return self._buf[-win_len:]

    def _silence_based_commit(self) -> None:
        """
        Very simple 'commit' policy:
          If we've seen MIN_FINAL_SILENCE_S of 'no new samples' or explicit silence chunk,
          we mark everything up to fed_seconds as 'finalizable' boundary.
        You can wire a real VAD to set _last_speech_time precisely.
        """
        now_t = self.fed_seconds
        if (now_t - self._last_speech_time) >= MIN_FINAL_SILENCE_S:
            self._finalized_until = max(self._finalized_until, now_t)

    def mark_speech_activity(self, is_speech: bool) -> None:
        """Invoke this if you run an external VAD gate."""
        if is_speech:
            self._last_speech_time = self.fed_seconds

    def poll(self) -> Tuple[str, List[FinalChunk]]:
        """
        Decode at most every MIN_EMIT_INTERVAL_S. Return:
            partial_text (string),
            finalized_segments (list of FinalChunk) since last call
        """
        now = time.time()
        if (now - self._last_decode_t) < MIN_EMIT_INTERVAL_S:
            # Still allow silence-based finalization without re-decoding
            self._silence_based_commit()
            return self._partial_accum, []

        self._last_decode_t = now

        window = self._current_window()
        if window is None or len(window) == 0:
            self._silence_based_commit()
            return self._partial_accum, []

        # Run faster-whisper on the current window.
        # We do not use VAD filter here; if you want, set vad_filter=True.
        segments, _info = self.model.transcribe(
            audio=window,
            beam_size=self.beam_size,
            temperature=self.temperature,
            word_timestamps=self.word_ts,
            initial_prompt=None,
            condition_on_previous_text=False,
            vad_filter=False,
            no_speech_threshold=0.6,
        )

        # Convert local (0..WINDOW_S) times to global timeline near the buffer end.
        # The window is aligned to the *end* of the buffer.
        win_end_global = self.fed_seconds
        win_start_global = max(0.0, win_end_global - WINDOW_S)

        partial_text = ""
        finals: List[FinalChunk] = []

        for seg in segments:
            seg_start = win_start_global + float(seg.start)
            seg_end = win_start_global + float(seg.end)
            text = seg.text

            # Heuristic: anything fully before _finalized_until is final.
            if seg_end <= self._finalized_until:
                words = None
                if self.word_ts and getattr(seg, "words", None):
                    words = [
                        {
                            "word": w.word,
                            "start": win_start_global + float(w.start),
                            "end": win_start_global + float(w.end),
                        }
                        for w in seg.words
                    ]
                finals.append(FinalChunk(text=text, start=seg_start, end=seg_end, words=words))
            else:
                # anything after the 'commit line' is current partial
                partial_text += text

        self._silence_based_commit()
        # Cache last partial for smoother UI
        self._partial_accum = partial_text.strip()
        return self._partial_accum, finals

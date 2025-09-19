from __future__ import annotations

import asyncio
import os
import time
import wave
from typing import Callable, Dict, Optional

import numpy as np

PCM_SR = 48_000


def _float_to_i16(x: np.ndarray) -> np.ndarray:
    y = np.clip(x, -1.0, 1.0)
    return (y * 32767.0).astype(np.int16)


class _WavHandle:
    def __init__(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self._wf = wave.open(path, "wb")
        self._wf.setnchannels(1)
        self._wf.setsampwidth(2)  # 16-bit
        self._wf.setframerate(PCM_SR)

    def write_i16(self, pcm_i16: np.ndarray) -> None:
        self._wf.writeframes(pcm_i16.tobytes())

    def close(self) -> None:
        try:
            self._wf.close()
        except Exception:
            pass


class ConversationRecorder:
    """
    Files:
      - mixed.wav : full-room mix (beep dropped whenever someone speaks)
      - <Name>/messages/NNN_<label>.wav : one file per message for each speaker
    """
    def __init__(self, *, out_dir: str, room_id: Optional[str]=None,
                 name_resolver: Optional[Callable[[str], str]] = None) -> None:
        ts = time.strftime("%Y%m%d-%H%M%S")
        room_tag = f"{room_id}_" if room_id else ""
        self.base_dir = os.path.join(out_dir, f"{room_tag}{ts}")
        self._name_resolver = name_resolver or (lambda sid: sid)
        self._lock = asyncio.Lock()
        self._mixed_handle: Optional[_WavHandle] = None
        # active per-source segment (open only while that speaker is "in message")
        self._active_segments: Dict[str, _WavHandle] = {}
        self._msg_index: Dict[str, int] = {}  # per display name counter
        # continuous per-subscriber perspective recordings (what each subscriber hears)
        self._heard_handles: Dict[str, _WavHandle] = {}

    # ---------- GLOBAL MIX ----------
    async def write_global_mixed_float(self, pcm_f32: np.ndarray) -> None:
        pcm_i16 = _float_to_i16(pcm_f32)
        async with self._lock:
            if self._mixed_handle is None:
                self._mixed_handle = _WavHandle(os.path.join(self.base_dir, "mixed.wav"))
            self._mixed_handle.write_i16(pcm_i16)

    # ---------- PER-MESSAGE SEGMENTS (PUBLIC API) ----------
    async def start_segment(self, source_id: str, label: Optional[str] = None) -> None:
        """Begin a new message file for a speaker. Safe to call if already open (no-op)."""
        name = self._safe_name(self._name_resolver(source_id))
        async with self._lock:
            if source_id in self._active_segments:
                return
            idx = self._msg_index.get(name, 0) + 1
            self._msg_index[name] = idx
            if not label:
                label = time.strftime("%H%M%S")
            fname = f"{idx:03d}_{label}.wav"
            path = os.path.join(self.base_dir, name, "messages", fname)
            self._active_segments[source_id] = _WavHandle(path)

    async def write_source_float(self, source_id: str, pcm_f32: np.ndarray) -> None:
        """Append audio to the currently-open message file for this source (if any)."""
        async with self._lock:
            h = self._active_segments.get(source_id)
            if not h:
                return
            h.write_i16(_float_to_i16(pcm_f32))

    async def write_heard_float(self, subscriber_id: str, pcm_f32: np.ndarray) -> None:
        """Append audio to the continuous heard.wav for this subscriber (creates if missing)."""
        pcm_i16 = _float_to_i16(pcm_f32)
        name = self._safe_name(self._name_resolver(subscriber_id))
        async with self._lock:
            h = self._heard_handles.get(subscriber_id)
            if h is None:
                path = os.path.join(self.base_dir, name, "heard.wav")
                h = _WavHandle(path)
                self._heard_handles[subscriber_id] = h
            h.write_i16(pcm_i16)

    async def end_segment(self, source_id: str) -> None:
        """Close the current message file for this source (if any)."""
        async with self._lock:
            h = self._active_segments.pop(source_id, None)
            if h:
                h.close()

    async def close(self) -> None:
        async with self._lock:
            if self._mixed_handle:
                self._mixed_handle.close()
                self._mixed_handle = None
            for h in list(self._active_segments.values()):
                try: h.close()
                except Exception: pass
            self._active_segments.clear()
            for h in list(self._heard_handles.values()):
                try: h.close()
                except Exception: pass
            self._heard_handles.clear()

    @staticmethod
    def _safe_name(name: str) -> str:
        # Simple sanitization for filesystem folder names
        keep = [c for c in name if (c.isalnum() or c in ("_", "-", " "))]
        s = ("".join(keep)).strip()
        return s or "user"




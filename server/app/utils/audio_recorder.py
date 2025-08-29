# server/app/audio_recorder.py
import os
import wave
import time
import asyncio
import numpy as np
from typing import Dict, Optional

PCM_SR = 48_000

def float_to_i16(x: np.ndarray) -> np.ndarray:
    return (np.clip(x, -1.0, 1.0) * 32767.0).astype(np.int16)

class _WavHandle:
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self._wf = wave.open(path, "wb")
        self._wf.setnchannels(1)
        self._wf.setsampwidth(2)  # 16-bit
        self._wf.setframerate(PCM_SR)

    def write_i16(self, pcm_i16: np.ndarray):
        self._wf.writeframes(pcm_i16.tobytes())

    def close(self):
        try:
            self._wf.close()
        except Exception:
            pass

class AudioRecorder:
    """
    Very small recorder that writes:
      - one WAV per source_id for inbound pre-mix audio
      - one WAV for the bus-mixed output
    """
    def __init__(self, out_dir: str = "./recordings", room_id: Optional[str] = None):
        ts = time.strftime("%Y%m%d-%H%M%S")
        room_tag = f"{room_id}_" if room_id else ""
        self.base = os.path.join(out_dir, f"{room_tag}{ts}")
        self._per_source: Dict[str, _WavHandle] = {}
        self._mixed: Optional[_WavHandle] = None
        self._lock = asyncio.Lock()

    async def write_source_float(self, source_id: str, pcm_f32: np.ndarray):
        pcm_i16 = float_to_i16(pcm_f32)
        async with self._lock:
            if source_id not in self._per_source:
                path = os.path.join(self.base, f"src_{source_id}.wav")
                self._per_source[source_id] = _WavHandle(path)
            self._per_source[source_id].write_i16(pcm_i16)

    async def write_mixed_float(self, pcm_f32: np.ndarray):
        pcm_i16 = float_to_i16(pcm_f32)
        async with self._lock:
            if self._mixed is None:
                path = os.path.join(self.base, "bus_mixed.wav")
                self._mixed = _WavHandle(path)
            self._mixed.write_i16(pcm_i16)

    async def close(self):
        async with self._lock:
            if self._mixed:
                self._mixed.close()
                self._mixed = None
            for h in self._per_source.values():
                h.close()
            self._per_source.clear()

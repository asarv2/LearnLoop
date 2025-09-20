# server/app/agents/beep.py
from __future__ import annotations

import asyncio
import math

import numpy as np

from ..bus import PCM_SR, SAMPLES_PER_CHUNK
from .base import Agent


def tone_chunk(freq_hz: float, phase: float, length_samples: int) -> tuple[np.ndarray, float]:
    t = (np.arange(length_samples, dtype=np.float32)) / PCM_SR
    omega = 2.0 * math.pi * freq_hz
    # ~ -24 dBFS amplitude
    amp = 10.0 ** (-24.0 / 20.0)
    y = (amp * np.sin(omega * t + phase)).astype(np.float32)
    # ~2ms fade to avoid clicks on continuous loop boundaries
    fade = min(96, length_samples // 10)
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        y[:fade] *= ramp
        y[-fade:] *= ramp[::-1]
    phase = (phase + omega * (length_samples / PCM_SR)) % (2.0 * math.pi)
    return y, phase


class BeepAgent(Agent):
    async def _run(self) -> None:
        """
        Continuously emit a low-level 880 Hz tone in 20 ms frames.
        Audibility is controlled via bus ignore sets from the Room.
        """
        freq = 880.0
        phase = 0.0
        chunk_len = SAMPLES_PER_CHUNK  # 20ms @ 48k

        while True:
            y, phase = tone_chunk(freq, phase, chunk_len)
            await self.publish_audio(y)
            await asyncio.sleep(chunk_len / PCM_SR)  # match bus cadence

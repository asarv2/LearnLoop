from __future__ import annotations

import asyncio
import math
from dataclasses import dataclass

import numpy as np

from ..bus import PCM_SR, SAMPLES_PER_CHUNK
from .base import Agent


def tone_chunk(freq: float, phase: float, n: int) -> tuple[np.ndarray, float]:
    t = np.arange(n) / PCM_SR
    y = 0.1 * np.sin(2 * np.pi * freq * t + phase).astype(np.float32)
    phase = (phase + 2 * np.pi * freq * (n / PCM_SR)) % (2 * np.pi)
    return y, phase


@dataclass
class BeepAgent(Agent):
    async def _run(self) -> None:
        phase = 0.0
        while True:
            freq = 440.0
            chunk_len = SAMPLES_PER_CHUNK
            y, phase = tone_chunk(freq, phase, chunk_len)
            await self.publish_audio(y)
            await asyncio.sleep(0.020)



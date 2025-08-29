# server/app/agents/beep.py
from __future__ import annotations

import asyncio
import math

import numpy as np
from app.bus import PCM_SR, SAMPLES_PER_CHUNK
from app.services.agents.voice.base import Agent


def tone_chunk(freq_hz: float, phase: float, length_samples: int) -> tuple[np.ndarray, float]:
    t = (np.arange(length_samples, dtype=np.float32)) / PCM_SR
    omega = 2.0 * math.pi * freq_hz
    y = np.sin(omega * t + phase).astype(np.float32)
    y *= 0.2  # level
    # ~2ms fade to avoid clicks
    fade = min(96, length_samples // 10)
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        y[:fade] *= ramp
        y[-fade:] *= ramp[::-1]
    phase = (phase + omega * (length_samples / PCM_SR)) % (2.0 * math.pi)
    return y, phase


class BeepAgent(Agent):
    async def _run(self):
        """
        Every 3s:
          - send a 1s, 440Hz beep (20ms chunks)
          - stream a small two-chunk text message
        """
        freq = 440.0
        phase = 0.0
        chunk_len = SAMPLES_PER_CHUNK        # 20ms @ 48k
        chunks_per_beep = int(1.0 / 0.02)    # 1s / 20ms = 50

        while True:
            # updated message text
            mid = await self.publish_text_chunk(
                text="[beep] ping… 1s tone",
                message_id=None,
                chunk_idx=0,
                is_final=False,
            )

            for _ in range(chunks_per_beep):
                y, phase = tone_chunk(freq, phase, chunk_len)
                await self.publish_audio(y)
                await asyncio.sleep(0.020)  # match bus cadence

            await self.publish_text_chunk(
                text=" done ✅",
                message_id=mid,
                chunk_idx=1,
                is_final=True,
            )

            await asyncio.sleep(2.0)  # ~3s cycle total

# server/app/agents/echo.py
from __future__ import annotations

import math
import time
from typing import Any

import numpy as np

from app.services.agents.voice.base import Agent


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x * x)) + 1e-12)


def _db(v: float) -> float:
    return 20.0 * math.log10(v)


class EchoAgent(Agent):
    """
    True echo: listens to the room mix (excluding itself) and plays it back attenuated
    only when input is above a rudimentary VAD threshold.
    """

    def __init__(
        self,
        *args: Any,
        vad_thresh_db: float = -55.0,
        vad_hang_ms: int = 500,
        echo_gain: float = 1.0,  # we'll manage level via AGC below
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, **kwargs)
        self.vad_thresh_db = vad_thresh_db
        self.vad_hang_ms = vad_hang_ms
        self.echo_gain = echo_gain

    def _agc(
        self,
        x: np.ndarray,
        target_db: float = -20.0,  # aim around 0.1 RMS
        max_gain_db: float = 24.0,
    ) -> tuple[np.ndarray, float, float]:
        r = _rms(x)
        target = 10 ** (target_db / 20.0)
        max_g = 10 ** (max_gain_db / 20.0)
        g = min(max_g, target / max(r, 1e-9))
        y = np.clip(x * g, -1.0, 1.0).astype(np.float32)
        return y, _db(r), _db(g)

    async def _run(self) -> None:
        speaking = False
        last_loud_ms = 0.0

        while True:
            chunk = await self.sub.recv()  # 20ms mono float32

            in_db = _db(_rms(chunk.data))
            now_ms = time.time() * 1000.0

            if in_db > self.vad_thresh_db:
                speaking = True
                last_loud_ms = now_ms
            elif speaking and (now_ms - last_loud_ms) > self.vad_hang_ms:
                speaking = False

            if speaking:
                y, rms_db, g_db = self._agc(chunk.data)
                y = (self.echo_gain * y).astype(np.float32)
                await self.publish_audio(y)
                # optional: visibility while tuning
                # print(f"[echo] in={in_db:.1f}dB rms={rms_db:.1f}dB gain={g_db:.1f}dB")

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .base import Agent


@dataclass
class LoggerAgent(Agent):
    async def _run(self) -> None:
        while True:
            chunk = await self.sub.recv()
            rms = float(np.sqrt(np.mean(chunk.data ** 2)) + 1e-12)
            pk = float(np.max(np.abs(chunk.data)))
            n = chunk.meta.get("n", "?")
            print(f"[logger] seq={chunk.seq} n={n} rms={rms:.3f} peak={pk:.3f}")



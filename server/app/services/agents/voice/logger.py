# server/app/agents/logger.py
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Optional

import numpy as np
from app.services.agents.voice.base import Agent
from app.utils.audio_recorder import AudioRecorder  # optional


@dataclass
class LoggerAgent(Agent):
    """
    Subscribes to the room mix and logs levels. Optionally records to WAV.
    """
    recorder: Optional[AudioRecorder] = None
    _stopped: bool = False

    async def _run(self) -> None:
        while not self._stopped:
            chunk = await self.sub.recv()  # AudioChunk float32 mono
            # Console log (RMS/peak, n sources if present)
            rms = float(np.sqrt(np.mean(chunk.data ** 2)) + 1e-12)
            pk = float(np.max(np.abs(chunk.data)))
            n = chunk.meta.get("n", "?")
            print(f"[logger] seq={chunk.seq} n={n} rms={rms:.3f} peak={pk:.3f}")

            if self.recorder is not None:
                await self.recorder.write_mixed_float(chunk.data)

    async def stop(self) -> None:
        self._stopped = True
        await super().stop()

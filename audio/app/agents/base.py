from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Awaitable, Callable, Optional

import numpy as np

from ..bus import PCM_SR, AudioBus, AudioChunk

AgentAudioHook = Callable[[AudioChunk], Awaitable[AudioChunk]]


@dataclass
class Agent:
    id: str
    bus: AudioBus
    audio_hook: Optional[AgentAudioHook] = None
    task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self.task and not self.task.done():
            return
        self.sub = self.bus.subscribe(self.id)
        self.task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
        self.bus.unsubscribe(self.id)

    async def _run(self) -> None:  # override
        raise NotImplementedError

    async def publish_audio(self, pcm_f32: np.ndarray) -> None:
        chunk = AudioChunk(
            data=np.clip(pcm_f32, -1.0, 1.0).astype(np.float32),
            sr=PCM_SR,
            source_id=self.id,
            seq=0,
            meta={},
        )
        if self.audio_hook:
            chunk = await self.audio_hook(chunk)
        pcm_i16 = (chunk.data * 32767.0).astype(np.int16)
        await self.bus.ingest_i16(self.id, pcm_i16, PCM_SR)



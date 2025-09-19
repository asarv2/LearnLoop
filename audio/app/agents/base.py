from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING, Awaitable, Callable, Optional

import numpy as np

from ..bus import PCM_SR, AudioBus, AudioChunk

if TYPE_CHECKING:
    from ..room import Room

AgentAudioHook = Callable[[AudioChunk], Awaitable[AudioChunk]]


@dataclass
class Agent:
    id: str
    bus: AudioBus
    room: "Room"
    audio_hook: Optional[AgentAudioHook] = None
    task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self.task and not self.task.done():
            return
        self.sub = self.bus.subscribe(self.id)
        try:
            self.room.register_agent(self.id, description="")
        except Exception:
            pass
        self.task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
        self.bus.unsubscribe(self.id)

    async def _run(self) -> None:
        raise NotImplementedError

    async def publish_audio(self, pcm_f32: np.ndarray) -> None:
        data = np.clip(pcm_f32, -1.0, 1.0).astype(np.float32)
        chunk = AudioChunk(data=data, sr=PCM_SR, source_id=self.id, seq=0, meta={})
        if self.audio_hook:
            chunk = await self.audio_hook(chunk)
        try:
            route_fn = getattr(self.room, "route_agent_output", None)
            if callable(route_fn):
                await route_fn(self.id, chunk.data)
                return
        except Exception:
            pass
        pcm_i16 = (chunk.data * 32767.0).astype(np.int16)
        await self.bus.ingest_i16(self.id, pcm_i16, PCM_SR)

    async def publish_text_chunk(
        self,
        text: str,
        *,
        message_id: Optional[str] = None,
        chunk_idx: int = 0,
        is_final: bool = True,
    ) -> str:
        return await self.room.append_text_chunk(
            source_id=self.id,
            role="agent",
            text=text,
            message_id=message_id,
            chunk_idx=chunk_idx,
            is_final=is_final,
        )

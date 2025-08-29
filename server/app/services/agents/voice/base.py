# server/app/agents/base.py
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Awaitable, Callable, Optional

import numpy as np
from app.bus import PCM_SR, AudioBus, AudioChunk

if TYPE_CHECKING:
    from app.room import Room  # only for type hints; avoids circular import

AgentAudioHook = Callable[[AudioChunk], Awaitable[AudioChunk]]

@dataclass
class Agent:
    id: str
    bus: AudioBus
    room: "Room"
    audio_hook: Optional[AgentAudioHook] = None
    task: Optional[asyncio.Task] = None

    def start(self):
        if self.task and not self.task.done():
            return
        # Subscribe to the *room mix* delivered to this subscriber
        self.sub = self.bus.subscribe(self.id)
        self.task = asyncio.create_task(self._run())

    async def stop(self):
        if self.task:
            self.task.cancel()
        self.bus.unsubscribe(self.id)

    async def _run(self):
        """Override in subclasses."""
        raise NotImplementedError

    # --- Publish helpers -----------------------------------------------------

    async def publish_audio(self, pcm_f32: np.ndarray):
        """Agents can speak back into the room (no VAD anywhere)."""
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

    async def publish_text_chunk(
        self,
        text: str,
        *,
        message_id: Optional[str] = None,
        chunk_idx: int = 0,
        is_final: bool = True,
    ) -> str:
        """Append a text chunk to the room's in-memory store (returns message_id)."""
        return await self.room.append_text_chunk(
            source_id=self.id,
            role="agent",
            text=text,
            message_id=message_id,
            chunk_idx=chunk_idx,
            is_final=is_final,
        )

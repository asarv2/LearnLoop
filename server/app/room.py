# room.py
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Protocol

import numpy as np
from app.bus import PCM_SR, SAMPLES_PER_CHUNK, AudioBus, AudioChunk
from app.services.agents.voice.beep import BeepAgent
from app.services.agents.voice.echo import EchoAgent
from app.services.agents.voice.logger import LoggerAgent
# new imports
from app.services.agents.voice.openai import OpenAIAgent
from app.store import create_room
from app.store import get_room as _get_room
from app.store import list_messages, upsert_text_chunk

FullChatCallback  = Callable[[str, list], Awaitable[None]]       # (room_id, messages[]) -> None
MessageCB         = Callable[[str, str], Awaitable[None]]        # (room_id, message_id) -> None
TextChunkBroadcaster = Callable[[Dict[str, Any]], Awaitable[None]]

class StoppableAgent(Protocol):
    async def stop(self) -> None: ...

@dataclass
class Room:
    id: str
    bus: AudioBus
    on_full_chat: Optional[FullChatCallback] = None
    on_agent_message: Optional[MessageCB] = None
    on_text_chunk: Optional[TextChunkBroadcaster] = None   # 👈 NEW
    # keep a handle on agents so we can stop them on cleanup
    agents: List[StoppableAgent] = field(default_factory=list)

    def register_agent(self, agent_id: str, description: str = ""):
        # just metadata; can expand later
        pass

    async def append_text_chunk(self, *, source_id: str, role: str,
                                text: str, message_id: Optional[str],
                                chunk_idx: int, is_final: bool) -> str:
        msg = upsert_text_chunk(self.id, message_id=message_id, source_id=source_id,
                                role=role, text=text, chunk_idx=chunk_idx, is_final=is_final)

        # The chunk we just appended is the last one; expose its ts_ms.
        last_chunk_ts = msg.chunks[-1].ts_ms if msg.chunks else int(time.time() * 1000)

        # 👇 Unified payload for the frontend
        payload = {
            "room_id": self.id,
            "message_id": msg.id,
            "source_id": source_id,
            "role": role,
            "text": text,
            "chunk_idx": chunk_idx,
            "is_final": is_final,
            # NEW: server-side clocks
            "created_ms": msg.created_ms,
            "chunk_ts_ms": last_chunk_ts,
        }

        if self.on_text_chunk:
            await self.on_text_chunk(payload)   # 👈 broadcast to sockets

        # per-message callback (e.g., persist agent outputs)
        if self.on_agent_message and role == "agent":
            await self.on_agent_message(self.id, msg.id)
        # full-chat callback (e.g., snapshot → archive)
        if self.on_full_chat and is_final:
            await self.on_full_chat(self.id, list_messages(self.id))
        return msg.id



ROOMS: Dict[str, Room] = {}

def get_room(room_id: Optional[str] = None) -> Room:
    if room_id is None:
        rec = create_room()
        rid = rec.id
    else:
        _ = _get_room(room_id)      # ensure exists
        rid = room_id
    r = ROOMS.get(rid)
    if r: return r
    bus = AudioBus()
    bus.start(period_ms=20)
    r = Room(id=rid, bus=bus)

    # # Beep agent: periodic tone + text
    # beep = BeepAgent(id="agent:beep", bus=bus, room=r)
    # beep.start()
    # r.agents.append(beep)

    # # Echo agent: true echo with simple VAD
    # echo = EchoAgent(
    #     id="agent:echo",
    #     bus=bus,
    #     room=r,
    #     vad_thresh_db=-55.0,  # more permissive
    #     vad_hang_ms=500,
    #     echo_gain=0.45,
    # )
    # echo.start()
    # r.agents.append(echo)

    # OpenAI agent
    openai = OpenAIAgent(id="agent:openai", bus=bus, room=r)
    openai.start()
    r.agents.append(openai)

    # # Logger (optional)
    # logger = LoggerAgent(id="agent:logger", bus=bus, room=r, recorder=None)
    # logger.start()
    # r.agents.append(logger)

    # # ⬇️ NEW: prevent Echo from hearing Beep (so it only reacts to humans)
    # bus.set_ignore("agent:echo", {"agent:beep"})

    ROOMS[rid] = r
    return r

async def cleanup_room(room_id: str):
    r = ROOMS.pop(room_id, None)
    if r:
        # stop agents cleanly
        for a in r.agents:
            try:
                await a.stop()
            except Exception:
                pass
        await r.bus.stop()

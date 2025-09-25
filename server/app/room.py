# room.py
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.bus import AudioBus
# new imports
from app.services.agents.voice.openai import OpenAIAgent
from app.store import create_room
from app.store import get_room as _get_room
from app.store import list_messages, upsert_text_chunk

FullChatCallback = Callable[
    [str, list], Awaitable[None]
]  # (room_id, messages[]) -> None
MessageCB = Callable[[str, str], Awaitable[None]]  # (room_id, message_id) -> None
TextChunkBroadcaster = Callable[[dict[str, Any]], Awaitable[None]]
TranscriptBroadcaster = Callable[[dict[str, Any]], Awaitable[None]]
TranscriptStopBroadcaster = Callable[[dict[str, Any]], Awaitable[None]]


class StoppableAgent(Protocol):
    async def stop(self) -> None: ...


@dataclass
class Room:
    id: str
    bus: AudioBus
    on_full_chat: FullChatCallback | None = None
    on_agent_message: MessageCB | None = None
    on_text_chunk: TextChunkBroadcaster | None = None  # 👈 NEW
    on_transcript: TranscriptBroadcaster | None = None
    on_transcript_stop: TranscriptStopBroadcaster | None = None
    # keep a handle on agents so we can stop them on cleanup
    agents: list[StoppableAgent] = field(default_factory=list)

    # Feature flag: enable word-level timestamp transcripts
    word_timestamps_enabled: bool = True
    
    # Internal flag for OpenAI agent text hooking
    _openai_text_hooked: bool = False

    # NEW: User identification fields
    user_profile_id: str | None = None
    user_persona_id: str | None = None
    
    # NEW: Current parent_id for message threading
    current_parent_id: str | None = None

    # Track human RTC participants (by sid)
    human_sids: set[str] = field(default_factory=set)

    # OpenAI agent lifecycle (lazy start/stop)
    openai_agent: OpenAIAgent | None = None
    _openai_started: bool = False
    _idle_shutdown_task: asyncio.Task | None = None

    def register_agent(self, agent_id: str, description: str = "") -> None:
        # just metadata; can expand later
        pass

    # ── Human presence tracking ───────────────────────────────────────────────
    def _cancel_idle_shutdown(self) -> None:
        t = self._idle_shutdown_task
        if t and not t.done():
            try:
                t.cancel()
            except Exception:
                pass
        self._idle_shutdown_task = None

    async def _start_openai(self) -> None:
        if self._openai_started:
            return
        if self.openai_agent is None:
            self.openai_agent = OpenAIAgent(id="agent:openai", bus=self.bus, room=self)
        try:
            self.openai_agent.start()
            self._openai_started = True
        except Exception:
            self._openai_started = False

    async def _stop_openai(self) -> None:
        if not self._openai_started:
            return
        try:
            if self.openai_agent is not None:
                await self.openai_agent.stop()
        except Exception:
            pass
        finally:
            self._openai_started = False

    async def human_join(self, sid: str) -> None:
        self.human_sids.add(sid)
        self._cancel_idle_shutdown()
        # Lazy-start OpenAI on first human
        if len(self.human_sids) == 1:
            await self._start_openai()

    async def human_leave(self, sid: str, *, idle_ms: int = 5000) -> None:
        self.human_sids.discard(sid)
        if len(self.human_sids) > 0:
            return
        # Graceful idle shutdown: stop OpenAI after a short delay to allow fast reconnects
        self._cancel_idle_shutdown()

        async def _idle() -> None:
            try:
                await asyncio.sleep(max(0, idle_ms) / 1000.0)
                if len(self.human_sids) == 0:
                    await self._stop_openai()
            except asyncio.CancelledError:
                pass

        self._idle_shutdown_task = asyncio.create_task(_idle())

    async def append_text_chunk(
        self,
        *,
        source_id: str,
        role: str,
        text: str,
        message_id: str | None,
        chunk_idx: int,
        is_final: bool,
        persona_id: str | None = None,
        voice: bool = False,
    ) -> str:
        # Use room's current_parent_id for all messages
        msg = await upsert_text_chunk(
            self.id,
            message_id=message_id,
            source_id=source_id,
            role=role,
            text=text,
            chunk_idx=chunk_idx,
            is_final=is_final,
            persona_id=persona_id,
            voice=voice,
            parent_id=self.current_parent_id,
        )

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
            # NEW: persona_id for UI rendering
            "persona_id": persona_id,
        }

        if self.on_text_chunk:
            await self.on_text_chunk(payload)  # 👈 broadcast to sockets

        # per-message callback (e.g., persist agent outputs)
        if self.on_agent_message and role == "agent":
            await self.on_agent_message(self.id, msg.id)
        # full-chat callback (e.g., snapshot → archive)
        if self.on_full_chat and is_final:
            await self.on_full_chat(self.id, list_messages(self.id))
        return msg.id

    def set_parent_id(self, parent_id: str | None) -> None:
        """Set the current parent_id for message threading."""
        self.current_parent_id = parent_id

    async def broadcast_transcript(
        self,
        *,
        agent_id: str,
        message_id: str | None,
        start_ts_ms: int,
        words: list[dict[str, Any]],
        full_text: str,
    ) -> None:
        if (not self.word_timestamps_enabled) or self.on_transcript is None:
            return
        payload = {
            "room_id": self.id,
            "agent_id": agent_id,
            "message_id": message_id,
            "start_ts_ms": start_ts_ms,
            "words": words,
            "text": full_text,
        }
        try:
            print(f"[ctc][room] tx words={len(words)} msg={message_id}")
        except Exception:
            pass
        await self.on_transcript(payload)

    # Toggle transcripts at runtime
    def set_word_timestamps_enabled(self, enabled: bool) -> None:
        self.word_timestamps_enabled = bool(enabled)

    # Back-compat alias
    def set_transcripts_enabled(self, enabled: bool) -> None:
        self.set_word_timestamps_enabled(enabled)

    async def broadcast_transcript_stop(
        self, *, agent_id: str, message_id: str | None, stop_ts_ms: int
    ) -> None:
        if self.on_transcript_stop is None:
            return
        payload = {
            "room_id": self.id,
            "agent_id": agent_id,
            "message_id": message_id,
            "stop_ts_ms": stop_ts_ms,
        }
        await self.on_transcript_stop(payload)


ROOMS: dict[str, Room] = {}


def get_room(room_id: str | None = None) -> Room:
    if room_id is None:
        rec = create_room()
        rid = rec.id
    else:
        _ = _get_room(room_id)  # ensure exists
        rid = room_id
    r = ROOMS.get(rid)
    if r:
        return r
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

    # Do not auto-start OpenAI; start lazily on first human join
    r.openai_agent = OpenAIAgent(id="agent:openai", bus=bus, room=r)
    r.agents.append(r.openai_agent)

    # # Logger (optional)
    # logger = LoggerAgent(id="agent:logger", bus=bus, room=r, recorder=None)
    # logger.start()
    # r.agents.append(logger)

    # # ⬇️ NEW: prevent Echo from hearing Beep (so it only reacts to humans)
    # bus.set_ignore("agent:echo", {"agent:beep"})

    ROOMS[rid] = r
    return r


async def cleanup_room(room_id: str) -> None:
    r = ROOMS.pop(room_id, None)
    if r:
        # stop agents cleanly
        for a in r.agents:
            try:
                await a.stop()
            except Exception:
                pass
        await r.bus.stop()

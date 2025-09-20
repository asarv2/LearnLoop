from __future__ import annotations

import asyncio
import collections
import json
import logging
import math
import os
import time
from dataclasses import dataclass, field
from typing import (TYPE_CHECKING, Any, Awaitable, Callable, Coroutine, Dict,
                    List, Literal, Optional, Protocol, Union)

import numpy as np

from .agents.beep import BeepAgent
from .agents.openai import OpenAIAgent
from .bus import PCM_SR, SAMPLES_PER_CHUNK, AudioBus
from .extensions import AUDIO_DIR
# Removed specific room imports - now using generic room creation from rooms.json
from .store import create_room
from .store import get_room as _get_room
from .store import list_messages, upsert_text_chunk
from .utils.conversation_recorder import ConversationRecorder

FullChatCallback = Callable[[str, list], Awaitable[None]]
MessageCB = Callable[[str, str], Awaitable[None]]
TextChunkBroadcaster = Callable[[Dict[str, Any]], Awaitable[None]]
TranscriptBroadcaster = Callable[[Dict[str, Any]], Awaitable[None]]
TranscriptStopBroadcaster = Callable[[Dict[str, Any]], Awaitable[None]]


@dataclass
class SpeakerState:
    mode: Literal["idle", "pending", "agent", "human"] = "idle"
    current_id: Optional[str] = None   # active talker (agent or human)
    next_id: Optional[str] = None      # candidate selected to speak next (pending)
    last_change_ms: int = field(default_factory=lambda: int(time.time() * 1000))
    version: int = 0

if TYPE_CHECKING:
    # Help static type checkers see broadcast_transcript attribute
    from typing import TypedDict

    class TranscriptPayload(TypedDict):
        room_id: str
        agent_id: str
        start_ts_ms: int
        words: List[Dict[str, Any]]
        text: str


class StoppableAgent(Protocol):
    async def stop(self) -> None: ...


@dataclass
class Room:
    id: str
    bus: AudioBus
    on_full_chat: Optional[FullChatCallback] = None
    on_agent_message: Optional[MessageCB] = None
    on_text_chunk: Optional[TextChunkBroadcaster] = None
    on_transcript: Optional[TranscriptBroadcaster] = None
    on_transcript_stop: Optional[TranscriptStopBroadcaster] = None
    agents: List[StoppableAgent] = field(default_factory=list)

    # routing/meta
    agent_meta: Dict[str, str] = field(default_factory=dict)
    agent_weights: Dict[str, float] = field(default_factory=dict)
    # turn policy
    agent_max_turns: Dict[str, Optional[int]] = field(default_factory=dict)
    agent_turns_since_user: Dict[str, int] = field(default_factory=dict)

    # text sinks: agent_id -> async fn(text)
    _text_sinks: Dict[str, Callable[[str], Awaitable[None]]] = field(default_factory=dict)
    _interrupt_handlers: Dict[str, Callable[[], Coroutine[Any, Any, None]]] = field(
        default_factory=dict
    )

    # simplified handover state
    _handover_pending: bool = False
    _current_speaker_id: Optional[str] = None
    _next_agent_id: Optional[str] = None
    _agent_start_ts_ms: Dict[str, int] = field(default_factory=dict)

    # router callback: choose next agent given finalized text/audio context
    _router: Optional[Union[
        Callable[["Room", Optional[str], Optional[str]], Optional[str]],
        Callable[["Room", Optional[str], Optional[str]], Awaitable[Optional[str]]],
    ]] = None

    # optional "fast flush" handlers the agents can register: agent_id -> async fn()
    _fast_flush_handlers: Dict[str, Callable[[], Awaitable[None]]] = field(default_factory=dict)

    # status
    _last_activity_ts: float = field(default_factory=lambda: time.time())

    # feature flags
    word_timestamps_enabled: bool = True

    # speaker state FSM
    _speaker_state: SpeakerState = field(default_factory=SpeakerState)
    _monitor_task: Optional[asyncio.Task] = None

    # segment closing tasks for tail-aware recording
    _segment_closers: Dict[str, asyncio.Task] = field(default_factory=dict)

    # Track the latest in-flight assistant message id per agent for UI clamping on interrupt
    _last_agent_msg_id: Dict[str, str] = field(default_factory=dict)

    # scenario + pseudo user state
    scenario_id: Optional[str] = None
    scenario_config: Dict[str, Any] = field(default_factory=dict)
    _pseudo_user_by_persona_id: Dict[str, str] = field(default_factory=dict)
    # For dynamic config path: map user profile_id -> pseudo agent id
    _pseudo_user_by_profile_id: Dict[str, str] = field(default_factory=dict)

    def register_agent(self, agent_id: str, description: str = "") -> None:
        self.agent_meta[agent_id] = ("human" if description == "human" else "agent")
        self.agent_weights.setdefault(agent_id, 1.0)
        # Initialize turn counters and defaults (None → infinite)
        self.agent_turns_since_user.setdefault(agent_id, 0)
        self.agent_max_turns.setdefault(agent_id, None)

    def set_agent_max_turns(self, agent_id: str, max_turns: Optional[int]) -> None:
        self.agent_max_turns[agent_id] = (None if max_turns is None else int(max_turns))
        self.agent_turns_since_user.setdefault(agent_id, 0)

    def reset_turns_on_user_input(self) -> None:
        try:
            for aid, kind in list(self.agent_meta.items()):
                if kind == "agent" and aid != "agent:beep":
                    self.agent_turns_since_user[aid] = 0
        except Exception:
            pass

    def is_agent_eligible(self, agent_id: str) -> bool:
        try:
            if self.agent_meta.get(agent_id) != "agent" or agent_id == "agent:beep":
                return False
            mt = self.agent_max_turns.get(agent_id)
            if mt is None:
                return True
            turns = int(self.agent_turns_since_user.get(agent_id, 0))
            return turns < int(mt)
        except Exception:
            return True

    def _eligible_agents(self) -> List[str]:
        try:
            return [a for a, k in self.agent_meta.items() if k == "agent" and a != "agent:beep" and self.is_agent_eligible(a)]
        except Exception:
            return []

    def _set_state(
        self,
        mode: Literal["idle", "pending", "agent", "human"],
        *,
        current: Optional[str] = None,
        nxt: Optional[str] = None,
    ) -> None:
        st = self._speaker_state
        st.mode = mode
        st.current_id = current
        st.next_id = nxt
        st.last_change_ms = int(time.time() * 1000)
        st.version += 1
        self._apply_beep_policy()

    def _apply_beep_policy(self) -> None:
        # Single place that decides beep audibility
        # Special case: with exactly two participants (one human, one agent), keep beep OFF for everyone
        try:
            kinds = list(self.agent_meta.values())
            agent_count = sum(1 for k in kinds if k == "agent" and k != "agent:beep")
            human_count = sum(1 for k in kinds if k == "human")
        except Exception:
            agent_count = 0
            human_count = 0
        if (agent_count == 1 and human_count == 1):
            self._update_beep_ignore(None, active=False)
            return
        # Default policy
        if self._speaker_state.mode == "pending":
            self._update_beep_ignore(self._speaker_state.next_id, active=True)
        else:
            self._update_beep_ignore(None, active=False)

    def start_monitor(self) -> None:
        if self._monitor_task is None or self._monitor_task.done():
            self._monitor_task = asyncio.create_task(self._monitor_loop())

    async def _monitor_loop(self) -> None:
        HUMAN_GRACE = 0.35  # seconds after last user frame still considered "speaking"
        AGENT_GRACE = 0.15  # seconds after last agent frame considered "speaking"
        last_agent_on: Optional[str] = None
        last_agent_ts = 0.0
        last_human_on: Optional[str] = None
        last_human_ts = 0.0
        while True:
            await asyncio.sleep(0.05)
            agents, humans = self.bus.active_sources()
            # Ignore the continuous beep source for agent activity decisions
            agents = [a for a in agents if a != "agent:beep"]
            now = time.time()
            if agents:
                last_agent_on, last_agent_ts = agents[0], now
            if humans:
                last_human_on, last_human_ts = humans[0], now

            agent_active = bool(last_agent_on) and (now - last_agent_ts) <= AGENT_GRACE
            human_active = bool(last_human_on) and (now - last_human_ts) <= HUMAN_GRACE

            # Pending means "we're beeping while waiting for next agent" — if someone starts talking, exit pending.
            if agent_active:
                if self._speaker_state.mode != "agent" or self._speaker_state.current_id != last_agent_on:
                    self._set_state("agent", current=last_agent_on)
            elif human_active:
                if self._speaker_state.mode != "human" or self._speaker_state.current_id != last_human_on:
                    self._set_state("human", current=last_human_on)
            else:
                # If a handover is pending and the room becomes quiet, re-enter pending state
                # so the beep is immediately audible to non-selected agents until the selected one starts.
                if self._handover_pending:
                    if self._speaker_state.mode != "pending" or self._speaker_state.next_id != self._next_agent_id:
                        self._set_state("pending", nxt=self._next_agent_id)
                else:
                    if self._speaker_state.mode != "idle":
                        self._set_state("idle")

    def register_text_sink(self, agent_id: str, sink: Callable[[str], Awaitable[None]]) -> None:
        self._text_sinks[agent_id] = sink

    # --- Controls ---
    def set_word_timestamps_enabled(self, enabled: bool) -> None:
        self.word_timestamps_enabled = bool(enabled)

    # Back-compat alias (temporary)
    def set_transcripts_enabled(self, enabled: bool) -> None:
        self.set_word_timestamps_enabled(enabled)

    def register_interrupt_handler(
        self, agent_id: str, handler: Callable[[], Coroutine[Any, Any, None]]
    ) -> None:
        self._interrupt_handlers[agent_id] = handler

    async def append_text_chunk(
        self,
        *,
        source_id: str,
        role: str,
        text: str,
        message_id: Optional[str],
        chunk_idx: int,
        is_final: bool,
    ) -> str:
        # Gate agent text against active-speaker state to prevent post-interrupt spillover
        if role == "agent":
            try:
                if not self._is_agent_allowed_to_append_text(
                    agent_id=source_id,
                    text=text,
                    is_final=is_final,
                    chunk_idx=chunk_idx,
                    message_id=message_id,
                ):
                    # If not allowed, drop this chunk silently. Preserve API contract by
                    # returning the existing message_id if provided, else empty string.
                    return message_id or ""
            except Exception:
                # Fail-open on gating errors to avoid wedging chat
                pass
        msg = upsert_text_chunk(
            self.id,
            message_id=message_id,
            source_id=source_id,
            role=role,
            text=text,
            chunk_idx=chunk_idx,
            is_final=is_final,
        )
        # Track the most recent assistant message id for interruption clamping
        try:
            if role == "agent" and (msg.id or "").strip():
                self._last_agent_msg_id[source_id] = msg.id
        except Exception:
            pass
        last_chunk_ts = msg.chunks[-1].ts_ms if msg.chunks else int(time.time() * 1000)
        payload = {
            "room_id": self.id,
            "message_id": msg.id,
            "source_id": source_id,
            "role": role,
            "text": text,
            "chunk_idx": chunk_idx,
            "is_final": is_final,
            "created_ms": msg.created_ms,
            "chunk_ts_ms": last_chunk_ts,
        }
        if self.on_text_chunk:
            await self.on_text_chunk(payload)
        if self.on_agent_message and role == "agent":
            await self.on_agent_message(self.id, msg.id)
        if self.on_full_chat and is_final:
            await self.on_full_chat(self.id, list_messages(self.id))
        # Reset turn counters when a typed user message is finalized
        try:
            if role == "user" and is_final and (text or "").strip():
                self.reset_turns_on_user_input()
        except Exception:
            pass
        return msg.id

    def _is_agent_allowed_to_append_text(
        self,
        *,
        agent_id: str,
        text: str,
        is_final: bool,
        chunk_idx: int,
        message_id: Optional[str],
    ) -> bool:
        """
        Centralized policy: Only allow agent text when the agent is the current speaker.
        Special-case: allow creation of an empty, non-final placeholder during pending handover
        for the next selected agent so transcripts can attach once audio starts.
        """
        st = self._speaker_state
        # Actively speaking agent may always append
        if st.mode == "agent" and st.current_id == agent_id:
            return True
        # During pending handover, allow only the minimal placeholder from the selected next agent
        if (
            st.mode == "pending"
            and st.next_id == agent_id
            and (not is_final)
            and chunk_idx == 0
            and (text or "").strip() == ""
        ):
            return True
        # Otherwise, block to prevent continued text when not the active speaker
        return False

    # --- buffer-based agent output routing ---
    async def route_agent_output(self, agent_id: str, pcm_f32: np.ndarray) -> None:
        # Simplified path: publish directly to bus
        i16 = (np.clip(pcm_f32, -1.0, 1.0) * 32767.0).astype(np.int16)
        await self.bus.ingest_i16(agent_id, i16, PCM_SR)

    async def broadcast_transcript(self, *, agent_id: str, message_id: Optional[str], start_ts_ms: int, words: List[Dict[str, Any]], full_text: str) -> None:
        if (not self.word_timestamps_enabled) or self.on_transcript is None:
            return
        payload = {
            "room_id": self.id,
            "agent_id": agent_id,
            "message_id": message_id,   # NEW
            "start_ts_ms": start_ts_ms,
            "words": words,
            "text": full_text,
        }
        await self.on_transcript(payload)

    def _ensure_handover_task(self) -> None:
        # no-op: handover loop removed
        return

    # External activation to request the next speaker
    def activate_agent_output(self, agent_id: str) -> None:
        # When an agent starts producing audio (or is preselected), mark as next
        self._next_agent_id = agent_id
        # Do not auto-start pending here to avoid churn; pending is set via router
        return

    def _update_beep_ignore(self, target_agent_id: Optional[str], active: bool) -> None:
        try:
            subs = list(getattr(self.bus, "_subs", {}).keys())
            current_ignores = getattr(self.bus, "_ignore", {})
            for sub_id in subs:
                # start with existing ignore set for this subscriber
                base = set(current_ignores.get(sub_id, set()))
                if not active:
                    # During inactive phase, ignore the continuous beep for everyone
                    base.add("agent:beep")
                    self.bus.set_ignore(sub_id, base)
                    continue
                # during active handover + beep phase:
                # - selected target agent and all humans should IGNORE the beep
                # - all other agents should NOT ignore the beep (so they hear it)
                kind = self.agent_meta.get(sub_id)
                is_human = (kind == "human")
                is_selected = (sub_id == (target_agent_id or ""))
                if is_human or is_selected:
                    base.add("agent:beep")
                else:
                    if "agent:beep" in base:
                        base.discard("agent:beep")
                self.bus.set_ignore(sub_id, base)
        except Exception:
            # best-effort; do not fail handover if ignore update has issues
            pass

    def get_agent_playback_start_ts(self, agent_id: str) -> Optional[int]:
        return self._agent_start_ts_ms.get(agent_id)


    async def notify_agent_text_finalized(self, agent_id: Optional[str], final_text: str) -> None:
        # Choose next agent via router callback if provided; fallback to round-robin
        next_id: Optional[str] = None
        router = self._router
        if router is not None:
            try:
                maybe = router(self, agent_id, final_text)
                if asyncio.iscoroutine(maybe):
                    next_id = await maybe  # type: ignore[assignment]
                else:
                    next_id = maybe  # type: ignore[assignment]
            except Exception:
                next_id = None
        # Enforce max_turns eligibility
        try:
            agents = [a for a, k in self.agent_meta.items() if k == "agent" and a != "agent:beep" and self.is_agent_eligible(a)]
            humans = [a for a, k in self.agent_meta.items() if k == "human"]
            candidates = agents + humans
        except Exception:
            candidates = []
        if not candidates:
            return
        if (next_id is None) or (next_id not in candidates):
            if agent_id and agent_id in candidates and len(candidates) > 1:
                idx = (candidates.index(agent_id) + 1) % len(candidates)
            else:
                idx = 0
            next_id = candidates[idx]
        self._next_agent_id = next_id
        try:
            print(f"[router] Next agent selected: {next_id} (after {agent_id or 'none'})")
        except Exception:
            pass
        # enter pending state: beep audible to others, gated for humans and selected
        self._handover_pending = True
        self._current_speaker_id = agent_id
        self._ensure_handover_task()
        # schedule tail-aware close for the agent that just finished
        if agent_id:
            self.schedule_segment_close_after_tail(agent_id)
        # set state to pending - this will apply beep policy
        self._set_state("pending", nxt=next_id)
        # fast-flush removed; rely on agent to speak naturally

    # Public API to inject routing strategy
    def set_router(self, router: Union[
        Callable[["Room", Optional[str], Optional[str]], Optional[str]],
        Callable[["Room", Optional[str], Optional[str]], Awaitable[Optional[str]]],
    ]) -> None:
        self._router = router

    def register_fast_flush(self, agent_id: str, fn: Callable[[], Awaitable[None]]) -> None:
        self._fast_flush_handlers[agent_id] = fn

    async def recorder_start_message(self, source_id: str, label: Optional[str]=None) -> None:
        try:
            if self.bus.recorder:
                await self.bus.recorder.start_segment(source_id, label)
        except Exception:
            pass

    async def recorder_end_message(self, source_id: str) -> None:
        try:
            if self.bus.recorder:
                await self.bus.recorder.end_segment(source_id)
        except Exception:
            pass

    def _cancel_segment_closer(self, source_id: str) -> None:
        t = self._segment_closers.pop(source_id, None)
        if t and not t.done():
            t.cancel()

    def _tail_seconds(self) -> float:
        # >= bus._agent_active_timeout; gives time for the drainer to finish
        return 0.35

    async def _close_after_tail(self, source_id: str) -> None:
        tail = self._tail_seconds()
        quiet_since = None
        try:
            while True:
                await asyncio.sleep(0.03)
                if self.bus.is_source_active(source_id):
                    quiet_since = None
                    continue
                now = time.time()
                if quiet_since is None:
                    quiet_since = now
                if (now - quiet_since) >= tail:
                    break
            await self.recorder_end_message(source_id)
        except asyncio.CancelledError:
            pass
        finally:
            self._segment_closers.pop(source_id, None)

    def schedule_segment_close_after_tail(self, source_id: str) -> None:
        # Avoid duplicate waiters
        if source_id in self._segment_closers and not self._segment_closers[source_id].done():
            return
        self._segment_closers[source_id] = asyncio.create_task(self._close_after_tail(source_id))

    def select_next_agent(self, current_agent_id: Optional[str], final_text: Optional[str]) -> Optional[str]:
        """Helper: pick next agent using router with fallback to round-robin."""
        next_id: Optional[str] = None
        router = self._router
        if router is not None:
            try:
                maybe = router(self, current_agent_id, final_text)
                if asyncio.iscoroutine(maybe):
                    # Note: synchronous helper; do not await here
                    pass
                else:
                    next_id = maybe  # type: ignore[assignment]
            except Exception:
                next_id = None
        try:
            agents = [a for a, k in self.agent_meta.items() if k == "agent" and self.is_agent_eligible(a)]
            humans = [a for a, k in self.agent_meta.items() if k == "human"]
            candidates = agents + humans
        except Exception:
            candidates = []
        if not candidates:
            return None
        if (next_id is None) or (next_id not in candidates):
            if current_agent_id and current_agent_id in candidates and len(candidates) > 1:
                idx = (candidates.index(current_agent_id) + 1) % len(candidates)
            else:
                idx = 0
            next_id = candidates[idx]
        return next_id

    async def _invoke_fast_flush(self, fn: Callable[[], Awaitable[None]]) -> None:
        await fn()

    async def interrupt(self) -> None:
        # Stop current buffer stream and clear queues
        await self.bus.interrupt()
        self._handover_pending = False
        self._current_speaker_id = None
        self._next_agent_id = None
        # cancel all segment closers
        for sid in list(self._segment_closers.keys()):
            self._cancel_segment_closer(sid)
        # set state to idle - this will apply beep policy
        self._set_state("idle")

        # Notify frontend to clamp progressive transcript rendering for any in-flight assistant messages
        try:
            if self.on_transcript_stop:
                now_ms = int(time.time() * 1000)
                for agent_id, msg_id in list(self._last_agent_msg_id.items()):
                    payload = {
                        "room_id": self.id,
                        "agent_id": agent_id,
                        "message_id": msg_id,
                        "stop_ts_ms": now_ms,
                    }
                    try:
                        await self.on_transcript_stop(payload)
                    except Exception:
                        pass
                    # Also finalize any non-final placeholder to remove typing indicators
                    try:
                        msgs = list_messages(self.id)
                        for m in msgs:
                            if m.id == msg_id and m.chunks:
                                if not m.chunks[-1].is_final:
                                    await self.append_text_chunk(
                                        source_id=agent_id,
                                        role="agent",
                                        text="",
                                        message_id=msg_id,
                                        chunk_idx=9999,
                                        is_final=True,
                                    )
                                break
                    except Exception:
                        pass
        except Exception:
            pass

        # Call registered agent interrupt handlers
        for handler in list(self._interrupt_handlers.values()):
            try:
                await handler()
            except Exception:
                pass
        # allow new processing
        self.bus.reset_after_interrupt()


    async def on_agent_response_started(self, agent_id: str) -> None:
        # Called by agents on first audio frame to flip beep gating off globally
        self._handover_pending = False
        self._current_speaker_id = agent_id
        try:
            t_ms = int(time.time() * 1000)
            self._agent_start_ts_ms[agent_id] = t_ms
        except Exception:
            pass
        # Increment turn count for this agent (max_turns enforcement)
        try:
            self.agent_turns_since_user[agent_id] = self.agent_turns_since_user.get(agent_id, 0) + 1
        except Exception:
            pass
        # cancel any existing closer for this agent and start new segment
        self._cancel_segment_closer(agent_id)
        await self.recorder_start_message(agent_id, label="agent")
        # set state to agent - this will apply beep policy
        self._set_state("agent", current=agent_id)

    # handover loop removed
    async def _handover_loop(self) -> None:
        return

    # --- Bus-driven speaker detection integration ---
    async def _on_bus_speaker_change(self, prev: Optional[str], curr: Optional[str]) -> None:
        # Treat the continuous beep as non-speaker
        if curr == "agent:beep":
            curr = None
        # Schedule tail-aware close for the previous agent speaker
        try:
            if prev and prev.startswith("agent:") and prev != "agent:beep" and prev != curr:
                self.schedule_segment_close_after_tail(prev)
        except Exception:
            pass

        # If an agent just stopped being the active speaker, notify UI to clamp transcript
        try:
            if prev and prev.startswith("agent:") and prev != "agent:beep" and prev != curr:
                msg_id = self._last_agent_msg_id.get(prev)
                if msg_id and self.on_transcript_stop:
                    payload = {
                        "room_id": self.id,
                        "agent_id": prev,
                        "message_id": msg_id,
                        "stop_ts_ms": int(time.time() * 1000),
                    }
                    await self.on_transcript_stop(payload)
                    # finalize any non-final placeholder so the UI stops showing typing
                    try:
                        msgs = list_messages(self.id)
                        for m in msgs:
                            if m.id == msg_id and m.chunks:
                                if not m.chunks[-1].is_final:
                                    await self.append_text_chunk(
                                        source_id=prev,
                                        role="agent",
                                        text="",
                                        message_id=msg_id,
                                        chunk_idx=9999,
                                        is_final=True,
                                    )
                                break
                    except Exception:
                        pass
        except Exception:
            pass

        if curr:
            if curr.startswith("agent:"):
                # Agent started speaking; end pending, start agent segment, update state
                self._handover_pending = False
                self._current_speaker_id = curr
                try:
                    t_ms = int(time.time() * 1000)
                    self._agent_start_ts_ms[curr] = t_ms
                except Exception:
                    pass
                self._cancel_segment_closer(curr)
                await self.recorder_start_message(curr, label="agent")
                self._set_state("agent", current=curr)
            else:
                # Human speaker
                # Interrupt any agents currently speaking/outputting
                try:
                    for aid, handler in list(self._interrupt_handlers.items()):
                        if aid.startswith("agent:"):
                            await handler()
                except Exception:
                    pass
                self._set_state("human", current=curr)
                # Reset turn counters when a human becomes active speaker
                try:
                    self.reset_turns_on_user_input()
                except Exception:
                    pass
        else:
            # No active speaker: if a handover is pending, go to pending to expose beep; else idle
            if self._handover_pending:
                self._set_state("pending", nxt=self._next_agent_id)
            else:
                self._set_state("idle")


ROOMS: Dict[str, Room] = {}


def load_scenarios_config() -> Dict[str, Any]:
    """Deprecated: scenarios now provided by server. Return empty mapping."""
    return {}


def load_personas() -> Dict[str, Any]:
    """Deprecated: personas now provided by server. Return empty mapping."""
    return {}


def create_room_from_scenario(scenario_id: str, bus: AudioBus, room: Room) -> List[OpenAIAgent]:
    """Create room agents based on configuration from scenarios.json"""
    scenarios_config = load_scenarios_config()
    personas = load_personas()
    
    if scenario_id not in scenarios_config:
        raise ValueError(f"Scenario ID {scenario_id} not found in scenarios.json")
    
    scenario_config = scenarios_config[scenario_id]
    agents: List[OpenAIAgent] = []
    
    # Create a mapping from role names to persona names for prompt replacement
    role_to_persona_name = {}
    persona_mapping = scenario_config.get("persona_mapping", {})
    
    for role_name, persona_id in persona_mapping.items():
        persona = personas.get(persona_id)
        if persona:
            role_to_persona_name[role_name] = persona["name"]
    
    # Determine whether actual users are required
    require_users: bool = bool(scenario_config.get("require_users", True))

    # Create agents based on the prompts in the scenario configuration
    # Only instantiate model agents for non-user personas.
    # If require_users is False, also instantiate pseudo-agents for user personas,
    # and remember their mapping so they can be replaced on real user join.
    for persona_id, prompt in scenario_config.get("prompts", {}).items():
        # Find the persona for this role
        persona = personas.get(persona_id)
        if not persona:
            raise ValueError(f"Persona {persona_id} not found in personas.json")

        is_user_persona = bool(persona.get("user", False))
        if is_user_persona and require_users:
            # Do not create agents for user personas when real users are required.
            continue
        
        # Replace role placeholders in the prompt with actual persona names
        personalized_prompt = prompt
        for role_name, persona_name in role_to_persona_name.items():
            personalized_prompt = personalized_prompt.replace(role_name, persona_name)
        
        # Create agent with the persona's voice and the personalized prompt
        agent_id = f"agent:{persona['name']}"
        agent = OpenAIAgent(
            id=agent_id,
            bus=bus,
            room=room,
            voice_name=(persona.get("voice") or "alloy"),
            instructions=personalized_prompt
        )
        agent.start()
        
        # Set max turns if specified in scenario config
        max_turns = scenario_config.get("max_turns", {}).get(persona_id)
        if max_turns is not None:
            room.set_agent_max_turns(agent_id, max_turns)
        
        agents.append(agent)

        # Track pseudo user mapping if applicable
        if is_user_persona and (not require_users):
            try:
                room._pseudo_user_by_persona_id[persona_id] = agent_id
            except Exception:
                pass
    
    return agents


def get_room(room_id: Optional[str] = None, scenario_id: str = "7b4e98cb-1588-4a97-aeb0-b524c70e5dc7") -> Room:
    if room_id is None:
        rec = create_room()
        rid = rec.id
    else:
        _ = _get_room(room_id)
        rid = room_id
    r = ROOMS.get(rid)
    if r:
        return r
    bus = AudioBus()
    bus.start(period_ms=20)
    r = Room(id=rid, bus=bus)

    # r.set_transcripts_enabled(False)

    # Continuous beep agent (audibility controlled via ignore sets)
    try:
        beep = BeepAgent(id="agent:beep", bus=bus, room=r)
        beep.start()
        r.agents.append(beep)
        # Default: when not in pending handover, ignore beep for everyone
        r._update_beep_ignore(None, active=False)
    except Exception:
        pass

    # Wire bus-driven speaker detection
    try:
        bus.set_speaker_change_hook(r._on_bus_speaker_change)
    except Exception:
        pass

    # Persist scenario details on the room for later logic (e.g., pseudo user adoption)
    try:
        r.scenario_id = scenario_id
        r.scenario_config = load_scenarios_config().get(scenario_id, {})
    except Exception:
        r.scenario_id = scenario_id
        r.scenario_config = {}

    # Create agents based on scenario configuration from scenarios.json
    try:
        agents = create_room_from_scenario(scenario_id, bus, r)
        # Add agents to room
        r.agents.extend(agents)
    except ValueError as e:
        # If scenario_id not found in scenarios.json, fall back to creating a default room
        # This maintains backward compatibility for any existing scenario IDs not in the config
        print(f"Warning: {e}. Creating default room without agents.")
        agents = []


    # Attach structured recorder
    try:
        def _name_resolver(source_id: str) -> str:
            if source_id.startswith("agent:") or source_id.startswith("user:"):
                return source_id.split(":", 1)[-1]
            return source_id

        bus.recorder = ConversationRecorder(
            out_dir=str(AUDIO_DIR),
            room_id=rid,
            name_resolver=_name_resolver,
        )
    except Exception:
        pass

    ROOMS[rid] = r
    return r


def create_room_with_config(
    *,
    room_id: Optional[str],
    require_users: bool = True,
    idle_timeout_ms: Optional[int] = None,
    enable_word_timestamps: bool = True,
    name: Optional[str] = None,
    problem_statement: Optional[str] = None,
    objectives: Optional[list[str]] = None,
    agents: Optional[list[dict]] = None,
) -> Room:
    """Create a room from a dynamic config instead of scenarios/personas.

    agents: list of { id: "agent:Name", voice: "alloy", instructions: "...", max_turns?: int }
    """
    rid: str
    if room_id is None:
        rec = create_room()
        rid = rec.id
    else:
        _ = _get_room(room_id)
        rid = room_id

    existing = ROOMS.get(rid)
    if existing:
        return existing

    bus = AudioBus()
    bus.start(period_ms=20)
    r = Room(id=rid, bus=bus)

    # Feature flags
    try:
        r.set_word_timestamps_enabled(bool(enable_word_timestamps))
    except Exception:
        pass

    # Continuous beep agent
    try:
        beep = BeepAgent(id="agent:beep", bus=bus, room=r)
        beep.start()
        r.agents.append(beep)
        r._update_beep_ignore(None, active=False)
    except Exception:
        pass

    # Bus-driven speaker detection
    try:
        bus.set_speaker_change_hook(r._on_bus_speaker_change)
    except Exception:
        pass

    # Store scenario-like metadata for UI/documentation
    try:
        r.scenario_id = "custom"
        r.scenario_config = {
            "require_users": bool(require_users),
            "idle_timeout_ms": int(idle_timeout_ms) if idle_timeout_ms is not None else None,
            "name": name,
            "problem_statement": problem_statement,
            "objectives": objectives or [],
        }
    except Exception:
        pass

    # Dynamic agents
    try:
        from .agents.openai import OpenAIAgent  # lazy import
        for spec in (agents or []):
            if not isinstance(spec, dict):
                continue
            # Skip user personas when real users are required
            try:
                if bool(spec.get("user", False)) and bool(require_users):
                    continue
            except Exception:
                pass
            aid = spec.get("id") or ""
            voice = spec.get("voice") or "alloy"
            instructions = spec.get("instructions") or "Be helpful."
            # Track pseudo user mapping for dynamic config when require_users=False
            try:
                if bool(spec.get("user", False)) and (not bool(require_users)):
                    pid = spec.get("profile_id") or None
                    if isinstance(pid, str) and pid:
                        # normalize agent id format
                        track_aid = aid if aid.startswith("agent:") else (f"agent:{aid}" if aid else "agent:assistant")
                        r._pseudo_user_by_profile_id[pid] = track_aid
            except Exception:
                pass
            if not aid.startswith("agent:"):
                aid = f"agent:{aid}" if aid else "agent:assistant"
            agent = OpenAIAgent(id=aid, bus=bus, room=r, voice_name=voice, instructions=instructions)
            agent.start()
            r.agents.append(agent)
            # max turns
            try:
                mt = spec.get("max_turns")
                if mt is not None:
                    r.set_agent_max_turns(aid, int(mt))
            except Exception:
                pass
    except Exception:
        pass

    ROOMS[rid] = r
    return r


def _remove_agent_from_room(room: Room, agent_id: str) -> None:
    """Internal utility: stop and remove an agent instance by id and clear related state."""
    try:
        # Find agent object
        target_idx = -1
        for idx, a in enumerate(room.agents):
            try:
                if getattr(a, "id", None) == agent_id:
                    target_idx = idx
                    break
            except Exception:
                pass
        if target_idx >= 0:
            a = room.agents.pop(target_idx)
            try:
                # stop will unsubscribe from bus
                asyncio.create_task(a.stop())
            except Exception:
                pass
    except Exception:
        pass
    # Clear room meta/policy
    try:
        room.agent_meta.pop(agent_id, None)
        room.agent_max_turns.pop(agent_id, None)
        room.agent_turns_since_user.pop(agent_id, None)
        room._last_agent_msg_id.pop(agent_id, None)
    except Exception:
        pass


def _is_require_users(room: Room) -> bool:
    try:
        return bool(room.scenario_config.get("require_users", True))
    except Exception:
        return True


def _persona_name_by_id(persona_id: str) -> Optional[str]:
    try:
        personas = load_personas()
        p = personas.get(persona_id)
        return p.get("name") if isinstance(p, dict) else None
    except Exception:
        return None


def _agent_id_for_persona(persona_id: str) -> Optional[str]:
    name = _persona_name_by_id(persona_id)
    if not name:
        return None
    return f"agent:{name}"


def _is_user_persona(persona_id: Optional[str]) -> bool:
    if not persona_id:
        return False
    try:
        personas = load_personas()
        p = personas.get(persona_id) or {}
        return bool(p.get("user", False))
    except Exception:
        return False


def adopt_user_join(room: Room, persona_id: Optional[str], human_id: str) -> None:
    """When a real user joins with a persona, remove the corresponding pseudo agent if present.

    Assumes the caller will register the human separately.
    """
    try:
        if not persona_id:
            return
        # Only relevant if the persona is a user persona and the scenario did not require users
        if not _is_user_persona(persona_id):
            return
        if _is_require_users(room):
            return
        # Look up the pseudo agent id we created for this persona
        agent_id = room._pseudo_user_by_persona_id.get(persona_id) or _agent_id_for_persona(persona_id)
        if not agent_id:
            return
        # Remove the pseudo agent from the room
        _remove_agent_from_room(room, agent_id)
        # Clear mapping so we don't try again
        room._pseudo_user_by_persona_id.pop(persona_id, None)
        # Beep policy/state will be applied on next state update automatically
    except Exception:
        pass


async def cleanup_room(room_id: str) -> None:
    r = ROOMS.pop(room_id, None)
    if r:
        for a in r.agents:
            try:
                await a.stop()
            except Exception:
                pass
        try:
            rec = getattr(r.bus, "recorder", None)
            close = getattr(rec, "close", None) if rec is not None else None
            if callable(close):
                await close()
        except Exception:
            pass
        await r.bus.stop()

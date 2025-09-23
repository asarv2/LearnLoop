from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Awaitable, Callable, Dict, Optional

import numpy as np

from .utils.conversation_recorder import ConversationRecorder

PCM_SR = 48_000
SAMPLES_PER_CHUNK = 960  # 20ms @ 48k mono


@dataclass
class AudioChunk:
    data: np.ndarray  # float32 mono [-1,1]
    sr: int
    source_id: str
    seq: int
    meta: dict


AgentAudioHook = Callable[[AudioChunk], Awaitable[AudioChunk]]
RoomMixHook = Callable[[AudioChunk], Awaitable[AudioChunk]]
SpeakerChangeHook = Callable[[Optional[str], Optional[str]], Awaitable[None]]


class Subscriber:
    def __init__(self, subscriber_id: str, queue_max: int = 256):
        self.id = subscriber_id
        self.queue: asyncio.Queue[AudioChunk] = asyncio.Queue(queue_max)

    async def send(self, chunk: AudioChunk) -> None:
        if self.queue.full():
            try:
                _ = self.queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        await self.queue.put(chunk)

    async def recv(self) -> AudioChunk:
        return await self.queue.get()

    async def clear(self) -> None:
        try:
            while True:
                self.queue.get_nowait()
                self.queue.task_done()
        except asyncio.QueueEmpty:
            return


class AudioBus:
    def __init__(self) -> None:
        self._latest: Dict[str, AudioChunk] = {}
        self._subs: Dict[str, Subscriber] = {}
        self._seq = 0
        self._lock = asyncio.Lock()
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_sent: Dict[str, int] = {}

        self.room_mix_hook: Optional[RoomMixHook] = None
        self.recorder: Optional[ConversationRecorder] = None

        # Interruption state
        self._interrupted: bool = False
        # activity thresholds
        self._active_rms = 1.2e-4
        self._user_active_timeout = 0.500
        self._agent_active_timeout = 0.030

        # per-subscriber ignore sets
        self._ignore: Dict[str, set[str]] = {}

        # speaker tracking
        self._current_speaker: Optional[str] = None
        self._speaker_change_hook: Optional[SpeakerChangeHook] = None
        # human priority and hysteresis
        self._human_hold_seconds: float = 0.250
        self._last_human_speaker: Optional[str] = None
        self._last_human_ts: float = 0.0

        # per-source tap callbacks: source_id -> list[callback]
        # special key "*" registers for all sources
        self._source_taps: Dict[str, list[Callable[[AudioChunk], Awaitable[None]]]] = {}

    def set_ignore(self, subscriber_id: str, sources: set[str]) -> None:
        self._ignore[subscriber_id] = set(sources)

    def subscribe(self, subscriber_id: str) -> Subscriber:
        sub = Subscriber(subscriber_id)
        self._subs[subscriber_id] = sub
        # Default: ignore beep for everyone unless 'pending' handoff makes it audible
        base = set(self._ignore.get(subscriber_id, set()))
        base.add("agent:beep")
        self._ignore[subscriber_id] = base
        return sub

    def unsubscribe(self, subscriber_id: str) -> None:
        self._subs.pop(subscriber_id, None)
        self._latest.pop(subscriber_id, None)
        self._last_sent.pop(subscriber_id, None)
        self._ignore.pop(subscriber_id, None)

    def set_speaker_change_hook(self, hook: Optional[SpeakerChangeHook]) -> None:
        self._speaker_change_hook = hook

    # --- Source taps API (for per-speaker listeners) ---
    def add_source_tap(self, source_id: str, cb: Callable[[AudioChunk], Awaitable[None]]) -> None:
        key = source_id if source_id else "*"
        self._source_taps.setdefault(key, []).append(cb)

    def remove_source_tap(self, source_id: str, cb: Callable[[AudioChunk], Awaitable[None]]) -> None:
        key = source_id if source_id else "*"
        lst = self._source_taps.get(key)
        if not lst:
            return
        try:
            lst.remove(cb)
        except ValueError:
            pass
        if not lst:
            self._source_taps.pop(key, None)

    async def interrupt(self) -> None:
        # Clear all subscriber queues and mark interrupted so mixer inserts silence until reset
        self._interrupted = True
        for sub in list(self._subs.values()):
            try:
                await sub.clear()
            except Exception:
                pass

    def reset_after_interrupt(self) -> None:
        self._interrupted = False

    def _is_active(self, c: AudioChunk) -> bool:
        rms = float(c.meta.get("rms", 0.0))
        ts = float(c.meta.get("ts", 0.0))
        fresh = (time.time() - ts) <= self._user_active_timeout
        return fresh and (rms >= self._active_rms)

    def has_active_user_audio(self) -> bool:
        snapshot = dict(self._latest)
        for c in snapshot.values():
            if c.source_id.startswith("agent:"):
                continue
            if self._is_active(c):
                return True
        return False

    def has_active_agent_audio(self) -> bool:
        snapshot = dict(self._latest)
        for c in snapshot.values():
            if not c.source_id.startswith("agent:"):
                continue
            ts = float(c.meta.get("ts", 0.0))
            if (time.time() - ts) <= self._agent_active_timeout:
                return True
        return False

    def is_source_active(self, source_id: str) -> bool:
        c = self._latest.get(source_id)
        if c is None:
            return False
        if source_id.startswith("agent:"):
            ts = float(c.meta.get("ts", 0.0))
            return (time.time() - ts) <= self._agent_active_timeout
        return self._is_active(c)

    def active_sources(self) -> tuple[list[str], list[str]]:
        """Returns (active_agents, active_humans) by current activity thresholds."""
        snapshot = dict(self._latest)
        now = time.time()
        agents: list[str] = []
        humans: list[str] = []
        for sid, c in snapshot.items():
            if sid.startswith("agent:"):
                ts = float(c.meta.get("ts", 0.0))
                if (now - ts) <= self._agent_active_timeout:
                    agents.append(sid)
            else:
                if self._is_active(c):
                    humans.append(sid)
        return agents, humans

    async def ingest_i16(self, source_id: str, pcm_i16: np.ndarray, sr: int) -> None:
        assert pcm_i16.ndim == 1 and sr == PCM_SR
        data = (pcm_i16.astype(np.float32) / 32768.0).clip(-1.0, 1.0)
        rms = float(np.sqrt(np.mean(data * data))) if data.size else 0.0
        async with self._lock:
            self._seq += 1
            chunk = AudioChunk(
                data=data,
                sr=sr,
                source_id=source_id,
                seq=self._seq,
                meta={"rms": rms, "ts": time.time()},
            )
            self._latest[source_id] = chunk
        # write to per-message segment if one is active
        try:
            if self.recorder and source_id != "agent:beep":
                await self.recorder.write_source_float(source_id, data)
        except Exception:
            pass
        # fan-out to source taps (wildcard first, then specific)
        try:
            for cb in list(self._source_taps.get("*", [])):
                try:
                    await cb(chunk)
                except Exception:
                    pass
            for cb in list(self._source_taps.get(source_id, [])):
                try:
                    await cb(chunk)
                except Exception:
                    pass
        except Exception:
            pass

    async def _mix(self, subset: Dict[str, AudioChunk]) -> Optional[AudioChunk]:
        if not subset:
            return None
        if self._interrupted:
            # During interruption, emit silence to fast-drain subscribers
            silence = np.zeros(SAMPLES_PER_CHUNK, dtype=np.float32)
            return AudioChunk(
                data=silence,
                sr=PCM_SR,
                source_id="bus",
                seq=max((c.seq for c in subset.values()), default=0),
                meta={"n": 0, "interrupted": True, "sources": [], "includes_beep": False},
            )
        # Speaker gating is applied per-subscriber in the caller; here we just mix the provided subset
        actives = []
        for c in subset.values():
            if c.source_id.startswith("agent:"):
                ts = float(c.meta.get("ts", 0.0))
                if (time.time() - ts) <= self._agent_active_timeout:
                    actives.append(c)
            elif self._is_active(c):
                actives.append(c)
        # Don't mix the beep when anyone else is active
        if any(c.source_id != "agent:beep" for c in actives):
            actives = [c for c in actives if c.source_id != "agent:beep"]
        if not actives:
            return None
        L = min(len(x.data) for x in actives)
        if L == 0:
            return None
        stacks = np.stack([x.data[:L] for x in actives], axis=0)
        mixed = np.mean(stacks, axis=0)
        src_ids = [x.source_id for x in actives]
        includes_beep = any(sid == "agent:beep" for sid in src_ids)
        out = AudioChunk(
            data=np.clip(mixed, -1, 1).astype(np.float32),
            sr=PCM_SR,
            source_id="bus",
            seq=max(x.seq for x in actives),
            meta={"n": len(actives), "sources": src_ids, "includes_beep": includes_beep},
        )
        if self.room_mix_hook:
            out = await self.room_mix_hook(out)
        return out

    def _determine_active_speaker(self, snapshot: Dict[str, AudioChunk]) -> Optional[str]:
        # Prefer humans over agents when both are active; apply a short human hold (hysteresis)
        now = time.time()
        human_candidates: list[AudioChunk] = []
        agent_candidates: list[AudioChunk] = []
        for c in snapshot.values():
            sid = c.source_id
            if sid == "agent:beep":
                continue
            ts = float(c.meta.get("ts", 0.0))
            if sid.startswith("agent:"):
                if (now - ts) <= self._agent_active_timeout:
                    agent_candidates.append(c)
            else:
                if self._is_active(c):
                    human_candidates.append(c)

        if human_candidates:
            freshest_human = max(human_candidates, key=lambda x: float(x.meta.get("ts", 0.0)))
            # update last human markers
            self._last_human_speaker = freshest_human.source_id
            self._last_human_ts = float(freshest_human.meta.get("ts", now))
            return freshest_human.source_id

        # No currently active human; if we very recently had one, keep them briefly to avoid flap
        if (
            self._current_speaker
            and (not self._current_speaker.startswith("agent:"))
            and self._last_human_speaker == self._current_speaker
            and (now - self._last_human_ts) <= self._human_hold_seconds
        ):
            return self._current_speaker

        if agent_candidates:
            freshest_agent = max(agent_candidates, key=lambda x: float(x.meta.get("ts", 0.0)))
            return freshest_agent.source_id

        return None

    async def _hard_cutover(self) -> None:
        # Clear all subscriber queues to drop any buffered mixed frames
        for sub in list(self._subs.values()):
            try:
                await sub.clear()
            except Exception:
                pass
        # Reset last_sent so each sub will accept the next outgoing frame
        self._last_sent.clear()

    async def _emit_speaker_change(self, prev: Optional[str], curr: Optional[str]) -> None:
        hook = self._speaker_change_hook
        if hook is None:
            return
        try:
            await hook(prev, curr)
        except Exception:
            pass

    async def _loop(self, period_ms: int) -> None:
        try:
            loop = asyncio.get_event_loop()
            while self._running:
                t0 = loop.time()
                async with self._lock:
                    snapshot = dict(self._latest)
                # Determine current active speaker and enforce hard cutover if it changes
                new_speaker = self._determine_active_speaker(snapshot) if snapshot else None
                if new_speaker != self._current_speaker:
                    prev = self._current_speaker
                    self._current_speaker = new_speaker
                    if new_speaker is not None:
                        try:
                            await self._hard_cutover()
                        except Exception:
                            pass
                    await self._emit_speaker_change(prev, new_speaker)
                if snapshot:
                    try:
                        out_master = await self._mix(snapshot)
                        if out_master and self.recorder:
                            await self.recorder.write_global_mixed_float(out_master.data)
                    except Exception:
                        pass
                    for sub_id, sub in list(self._subs.items()):
                        ignore = self._ignore.get(sub_id, set())
                        subset = {k: v for k, v in snapshot.items() if k != sub_id and k not in ignore}
                        # Apply per-subscriber gating: do not send a subscriber their own mic; during human speaking,
                        # allow the human to hear agents while others hear only the human; during agent speaking, gate to that agent.
                        curr = self._current_speaker
                        if curr:
                            if not curr.startswith("agent:"):
                                # Human is current speaker
                                if sub_id == curr:
                                    # The speaking human should hear agents (not self)
                                    subset = {k: v for k, v in subset.items() if k.startswith("agent:")}
                                else:
                                    # Others hear the human speaker only
                                    subset = {k: v for k, v in subset.items() if k == curr}
                            else:
                                # Agent is current speaker → everyone hears that agent only
                                subset = {k: v for k, v in subset.items() if k == curr}
                        if not subset:
                            continue
                        max_seq = max(v.seq for v in subset.values())
                        if self._last_sent.get(sub_id) == max_seq:
                            continue
                        out = await self._mix(subset)
                        if out:
                            await sub.send(out)
                            self._last_sent[sub_id] = max_seq
                            try:
                                if self.recorder:
                                    await self.recorder.write_heard_float(sub_id, out.data)
                            except Exception:
                                pass
                elapsed = int((loop.time() - t0) * 1000)
                await asyncio.sleep(max(0, (period_ms - elapsed) / 1000))
        except asyncio.CancelledError:
            pass

    def start(self, period_ms: int = 20) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(period_ms))

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

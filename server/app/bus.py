# bus.py
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import numpy as np

PCM_SR = 48_000
SAMPLES_PER_CHUNK = 960  # 20ms @ 48k mono


@dataclass
class AudioChunk:
    data: np.ndarray  # float32 mono [-1,1]
    sr: int
    source_id: str
    seq: int
    meta: dict  # we'll stash {'rms': float, 'ts': float} here


# Optional hooks (ONE agent-level for produced audio, ONE room-level for mixed out)
AgentAudioHook = Callable[[AudioChunk], Awaitable[AudioChunk]]
RoomMixHook = Callable[[AudioChunk], Awaitable[AudioChunk]]


class Subscriber:
    def __init__(self, subscriber_id: str, queue_max: int = 128):  # was 32
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


class AudioBus:
    def __init__(self) -> None:
        self._latest: dict[str, AudioChunk] = {}
        self._subs: dict[str, Subscriber] = {}
        self._seq = 0
        self._lock = asyncio.Lock()
        self._running = False
        self._task: asyncio.Task | None = None
        self._last_sent: dict[str, int] = {}  # sub_id -> last max seq delivered

        self.room_mix_hook: RoomMixHook | None = None

        # NEW: per-subscriber ignored sources + activity thresholding
        self._ignore: dict[str, set[str]] = {}
        self._active_rms = 3e-4  # was 1e-3 (~ -70 dBFS, less aggressive)
        self._active_timeout = 0.500  # a bit more forgiving

    def set_ignore(self, subscriber_id: str, sources: set[str]) -> None:
        self._ignore[subscriber_id] = set(sources)

    def subscribe(self, subscriber_id: str) -> Subscriber:
        sub = Subscriber(subscriber_id)
        self._subs[subscriber_id] = sub
        return sub

    def unsubscribe(self, subscriber_id: str) -> None:
        self._subs.pop(subscriber_id, None)
        self._latest.pop(subscriber_id, None)
        self._last_sent.pop(subscriber_id, None)
        self._ignore.pop(subscriber_id, None)

    def _is_active(self, c: AudioChunk) -> bool:
        rms = float(c.meta.get("rms", 0.0))
        ts = float(c.meta.get("ts", 0.0))
        fresh = (time.time() - ts) <= self._active_timeout
        return fresh and (rms >= self._active_rms)

    async def ingest_i16(self, source_id: str, pcm_i16: np.ndarray, sr: int) -> None:
        assert pcm_i16.ndim == 1 and sr == PCM_SR
        data = (pcm_i16.astype(np.float32) / 32768.0).clip(-1.0, 1.0)
        rms = float(np.sqrt(np.mean(data * data)))  # store energy
        async with self._lock:
            self._seq += 1
            self._latest[source_id] = AudioChunk(
                data=data,
                sr=sr,
                source_id=source_id,
                seq=self._seq,
                meta={"rms": rms, "ts": time.time()},
            )
        # print(f"[BUS] ingest from {source_id} seq={self._seq}")

    async def _mix(self, subset: dict[str, AudioChunk]) -> AudioChunk | None:
        if not subset:
            return None
        actives = []
        for c in subset.values():
            # ✅ never gate model/agent audio; gate only noisy inputs (e.g., mic)
            if c.source_id.startswith("agent:"):
                actives.append(c)
            elif self._is_active(c):
                actives.append(c)
        if not actives:
            return None
        L = min(len(x.data) for x in actives)
        if L == 0:
            return None
        stacks = np.stack([x.data[:L] for x in actives], axis=0)
        mixed = np.mean(stacks, axis=0)
        out = AudioChunk(
            data=np.clip(mixed, -1, 1).astype(np.float32),
            sr=PCM_SR,
            source_id="bus",
            seq=max(x.seq for x in actives),
            meta={"n": len(actives)},
        )
        if self.room_mix_hook:
            out = await self.room_mix_hook(out)
        return out

    async def _loop(self, period_ms: int) -> None:
        try:
            loop = asyncio.get_event_loop()
            while self._running:
                t0 = loop.time()
                async with self._lock:
                    snapshot = dict(self._latest)
                if snapshot:
                    for sub_id, sub in list(self._subs.items()):
                        ignore = self._ignore.get(sub_id, set())
                        subset = {
                            k: v
                            for k, v in snapshot.items()
                            if k != sub_id and k not in ignore
                        }
                        if not subset:
                            continue
                        max_seq = max(v.seq for v in subset.values())
                        if self._last_sent.get(sub_id) == max_seq:
                            continue
                        out = await self._mix(subset)
                        if out:
                            await sub.send(out)
                            self._last_sent[sub_id] = max_seq
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

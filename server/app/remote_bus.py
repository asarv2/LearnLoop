from __future__ import annotations

import asyncio
import json
import logging
import urllib.parse
from typing import Dict, Optional

import httpx  # type: ignore
import numpy as np
import websockets  # type: ignore
from app.bus import PCM_SR, SAMPLES_PER_CHUNK, AudioBus, AudioChunk, Subscriber
from websockets.legacy.client import WebSocketClientProtocol  # type: ignore

logger = logging.getLogger(__name__)


def _http_to_ws(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme == "http":
        scheme = "ws"
    elif parsed.scheme == "https":
        scheme = "wss"
    elif parsed.scheme in ("ws", "wss"):
        return url
    else:
        scheme = "ws"
    return urllib.parse.urlunparse(parsed._replace(scheme=scheme))


class RemoteAudioBus(AudioBus):
    """
    Remote adapter that implements the AudioBus interface by bridging to the
    external Audio Service over HTTP/WebSocket.

    Notes:
    - start()/stop() are no-ops; timing/mix loop is server-side in the Audio Service.
    - subscribe(): opens a dedicated /ws/subscribe connection and pumps frames into a local queue.
    - ingest_i16(): opens or reuses a dedicated /ws/ingest connection per source_id.
    - set_ignore(): POST to /rooms/{room_id}/ignore.
    """

    def __init__(self, base_url: str, room_id: str) -> None:
        # Do not initialize AudioBus local state; we override all methods used.
        self.base_url = base_url.rstrip("/")
        self.ws_base = _http_to_ws(self.base_url)
        self.room_id = room_id

        # per-subscriber receive task
        self._subs: Dict[str, Subscriber] = {}
        self._recv_tasks: Dict[str, asyncio.Task] = {}

        # per-source ingest connection
        self._ingest_ws: Dict[str, WebSocketClientProtocol] = {}
        self._ingest_locks: Dict[str, asyncio.Lock] = {}

        # control channel
        self._control_ws: Optional[WebSocketClientProtocol] = None
        self._control_lock: asyncio.Lock = asyncio.Lock()

        self._closed = False

    # ---------------- AudioBus API ----------------
    def start(self, period_ms: int = 20) -> None:  # type: ignore[override]
        # Remote bus runs its own loop; nothing to do.
        return

    async def stop(self) -> None:  # type: ignore[override]
        self._closed = True
        # Close subscriber tasks
        for t in list(self._recv_tasks.values()):
            try:
                t.cancel()
            except Exception:
                pass
        self._recv_tasks.clear()
        self._subs.clear()

        # Close ingest websockets
        for ws in list(self._ingest_ws.values()):
            try:
                await ws.close()
            except Exception:
                pass
        self._ingest_ws.clear()
        self._ingest_locks.clear()

        # Close control websocket
        if self._control_ws is not None:
            try:
                await self._control_ws.close()
            except Exception:
                pass
            self._control_ws = None

    def subscribe(self, subscriber_id: str) -> Subscriber:  # type: ignore[override]
        # Create local queue and start remote reader
        if subscriber_id in self._subs:
            return self._subs[subscriber_id]
        sub = Subscriber(subscriber_id)
        self._subs[subscriber_id] = sub
        task = asyncio.create_task(self._subscribe_recv_loop(subscriber_id, sub))
        self._recv_tasks[subscriber_id] = task
        return sub

    def unsubscribe(self, subscriber_id: str) -> None:  # type: ignore[override]
        # Cancel background receive task and drop queue; server cleans up remote sub automatically on socket close.
        t = self._recv_tasks.pop(subscriber_id, None)
        if t:
            try:
                t.cancel()
            except Exception:
                pass
        self._subs.pop(subscriber_id, None)

    def set_ignore(self, subscriber_id: str, sources: set[str]) -> None:  # type: ignore[override]
        # Send over control websocket
        async def _send() -> None:
            ws = await self._ensure_control()
            if ws is None:
                return
            msg = {
                "type": "set_ignore",
                "room_id": self.room_id,
                "subscriber_id": subscriber_id,
                "sources": list(sources),
            }
            try:
                await ws.send(json.dumps(msg))
            except Exception:
                pass
        asyncio.create_task(_send())

    async def ingest_i16(self, source_id: str, pcm_i16: np.ndarray, sr: int) -> None:  # type: ignore[override]
        if sr != PCM_SR:
            # Only 48k accepted
            return
        # Ensure connection and lock per source
        lock = self._ingest_locks.get(source_id)
        if lock is None:
            lock = asyncio.Lock()
            self._ingest_locks[source_id] = lock
        async with lock:
            ws = self._ingest_ws.get(source_id)
            if ws is None or getattr(ws, "closed", True):
                conn = await websockets.connect(f"{self.ws_base}/ws/ingest", max_queue=None)  # type: ignore[assignment]
                # handshake
                hello = {
                    "room_id": self.room_id,
                    "source_id": source_id,
                    "sr": PCM_SR,
                    "chunk_samples": SAMPLES_PER_CHUNK,
                }
                await conn.send(json.dumps(hello))
                self._ingest_ws[source_id] = conn  # type: ignore[assignment]
                ws = conn  # type: ignore[assignment]
            # send raw bytes
            if pcm_i16.dtype != np.int16:
                pcm_i16 = pcm_i16.astype(np.int16)
            if ws is not None:
                await ws.send(pcm_i16.tobytes())

    # ---------------- internals ----------------
    async def _subscribe_recv_loop(self, subscriber_id: str, sub: Subscriber) -> None:
        ws: Optional[WebSocketClientProtocol] = None
        try:
            ws = await websockets.connect(f"{self.ws_base}/ws/subscribe", max_queue=None)  # type: ignore[assignment]
            hello = {
                "room_id": self.room_id,
                "subscriber_id": subscriber_id,
                "sr": PCM_SR,
                "chunk_samples": SAMPLES_PER_CHUNK,
            }
            if ws is not None:
                await ws.send(json.dumps(hello))

            seq = 0
            while True:
                if ws is None:
                    break
                b = await ws.recv()
                if not isinstance(b, (bytes, bytearray)):
                    continue
                if len(b) != 2 * SAMPLES_PER_CHUNK:
                    continue
                x = np.frombuffer(b, dtype=np.int16)
                f32 = (x.astype(np.float32) / 32767.0).clip(-1.0, 1.0)
                seq += 1
                chunk = AudioChunk(
                    data=f32,
                    sr=PCM_SR,
                    source_id="bus",
                    seq=seq,
                    meta={"n": 1},
                )
                await sub.send(chunk)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.debug("remote subscribe loop ended", exc_info=False)
        finally:
            if ws is not None:
                try:
                    await ws.close()
                except Exception:
                    pass

    async def _ensure_control(self) -> Optional[WebSocketClientProtocol]:
        async with self._control_lock:
            ws = self._control_ws
            if ws is not None and not getattr(ws, "closed", True):
                return ws
            try:
                conn = await websockets.connect(f"{self.ws_base}/ws/control", max_queue=None)  # type: ignore[assignment]
                self._control_ws = conn  # type: ignore[assignment]
                return conn  # type: ignore[return-value]
            except Exception:
                return None



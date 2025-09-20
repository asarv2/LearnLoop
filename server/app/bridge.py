from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Any, Dict, Optional

import numpy as np  # type: ignore
import socketio  # type: ignore

log = logging.getLogger("audio_bridge")


class MixedAudioSubscriber:
    """Queue-backed subscriber fed by audio s2s_mixed_frame events."""

    def __init__(self, subscriber_id: str, queue_max: int = 256):
        self.id = subscriber_id
        self._queue: asyncio.Queue[np.ndarray] = asyncio.Queue(queue_max)

    async def send_i16(self, pcm_i16: np.ndarray) -> None:
        if self._queue.full():
            try:
                _ = self._queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        await self._queue.put(pcm_i16)

    async def recv_i16(self) -> np.ndarray:
        return await self._queue.get()


class AudioBridge:
    def __init__(self, server_sio: socketio.AsyncServer):
        self.server_sio = server_sio
        self.url = os.getenv("AUDIO_SERVICE_URL", "")
        self.secret = os.getenv("AUDIO_SECRET", "")
        self._client = socketio.AsyncClient()  # Socket.IO client for server-to-server communication
        self._connected = asyncio.Event()
        self._mix_subs: Dict[str, MixedAudioSubscriber] = {}

        # Wire client event handlers
        self._client.on("connect", self._on_connect)
        self._client.on("disconnect", self._on_disconnect)
        self._client.on("text_chunk", self._on_text_chunk)
        self._client.on("transcript", self._on_transcript)
        self._client.on("transcript_stop", self._on_transcript_stop)
        self._client.on("s2s_mixed_frame", self._on_s2s_mixed_frame)

    # ── lifecycle ─────────────────────────────────────────────────────────────
    async def start(self) -> None:
        if self._client.connected:
            return
        if not self.url:
            log.error("AUDIO_SERVICE_URL not configured - cannot connect to audio service")
            raise Exception("AUDIO_SERVICE_URL not configured")
        try:
            log.info(f"Connecting to audio service at {self.url}")
            await self._client.connect(self.url, socketio_path="socket.io")
            await self._connected.wait()
            log.info("Successfully connected to audio service")
        except Exception as e:
            log.error(f"Failed to connect to audio service at {self.url}: {e}")
            raise

    async def stop(self) -> None:
        try:
            await self._client.disconnect()
        except Exception:
            pass

    # ── upstream emits (include shared secret) ────────────────────────────────
    def _with_auth(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if self.secret:
            data = dict(data)
            data.setdefault("authToken", self.secret)
        return data

    async def start_room(self, *, room_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        await self._connected.wait()
        payload = self._with_auth({"room_id": room_id, **config})
        try:
            result = await self._client.call("s2s_start_room", payload, timeout=10.0)
            if isinstance(result, dict) and "error" in result:
                log.error(f"Audio service error starting room {room_id}: {result['error']}")
                raise Exception(f"Audio service error: {result['error']}")
            return result if isinstance(result, dict) else {}
        except Exception as e:
            log.error(f"Failed to start room {room_id} in audio service: {e}")
            print(f"[SERVER] Exception in start_room: {e}")
            raise

    async def stop_room(self, *, room_id: str) -> Dict[str, Any]:
        await self._connected.wait()
        try:
            result = await self._client.call("s2s_stop_room", self._with_auth({"room_id": room_id}), timeout=10.0)
            if isinstance(result, dict) and "error" in result:
                log.error(f"Audio service error stopping room {room_id}: {result['error']}")
                raise Exception(f"Audio service error: {result['error']}")
            return result if isinstance(result, dict) else {}
        except Exception as e:
            log.error(f"Failed to stop room {room_id} in audio service: {e}")
            raise

    async def register_human(self, *, room_id: str, human_id: str) -> Dict[str, Any]:
        await self._connected.wait()
        try:
            result = await self._client.call("s2s_register_human", self._with_auth({"room_id": room_id, "human_id": human_id}), timeout=5.0)
            if isinstance(result, dict) and "error" in result:
                log.error(f"Audio service error registering human {human_id} in room {room_id}: {result['error']}")
                raise Exception(f"Audio service error: {result['error']}")
            return result if isinstance(result, dict) else {}
        except Exception as e:
            log.error(f"Failed to register human {human_id} in room {room_id}: {e}")
            raise

    async def ingest_frame(self, *, room_id: str, source_id: str, pcm_i16: np.ndarray, sr: int = 48000) -> None:
        await self._connected.wait()
        b64 = base64.b64encode(pcm_i16.astype(np.int16).tobytes()).decode("ascii")
        try:
            await self._client.emit("s2s_ingest_frame", self._with_auth({
                "room_id": room_id,
                "source_id": source_id,
                "sr": int(sr),
                "format": "pcm16",
                "frame_b64": b64,
            }))
        except Exception as e:
            log.error(f"Failed to ingest frame for {source_id} in room {room_id}: {e}")
            # Don't raise here as this is called frequently and shouldn't break the flow

    async def user_text(self, *, room_id: str, human_id: str, text: str) -> Dict[str, Any]:
        """Send user text to audio service for TTS and streaming into the bus."""
        await self._connected.wait()
        try:
            payload = self._with_auth({
                "room_id": room_id,
                "human_id": human_id,
                "text": text,
            })
            result = await self._client.call("s2s_user_text", payload, timeout=10.0)
            if isinstance(result, dict) and "error" in result:
                log.error(f"Audio service error user_text in room {room_id}: {result['error']}")
                raise Exception(f"Audio service error: {result['error']}")
            return result if isinstance(result, dict) else {}
        except Exception as e:
            log.error(f"Failed to send user_text in room {room_id}: {e}")
            raise

    async def subscribe_mix(self, *, room_id: str, subscriber_id: str) -> MixedAudioSubscriber:
        await self._connected.wait()
        sub = self._mix_subs.get(subscriber_id)
        if sub is None:
            sub = MixedAudioSubscriber(subscriber_id)
            self._mix_subs[subscriber_id] = sub
        try:
            result = await self._client.call("s2s_subscribe_mix", self._with_auth({
                "room_id": room_id,
                "subscriber_id": subscriber_id,
            }), timeout=5.0)
            if isinstance(result, dict) and "error" in result:
                log.error(f"Audio service error subscribing to mix for {subscriber_id} in room {room_id}: {result['error']}")
                raise Exception(f"Audio service error: {result['error']}")
        except Exception as e:
            log.error(f"Failed to subscribe to mix for {subscriber_id} in room {room_id}: {e}")
            raise
        return sub

    async def unsubscribe_mix(self, *, room_id: str, subscriber_id: str) -> None:
        await self._connected.wait()
        try:
            result = await self._client.call("s2s_unsubscribe_mix", self._with_auth({
                "room_id": room_id,
                "subscriber_id": subscriber_id,
            }), timeout=5.0)
            if isinstance(result, dict) and "error" in result:
                log.error(f"Audio service error unsubscribing from mix for {subscriber_id} in room {room_id}: {result['error']}")
        except Exception as e:
            log.error(f"Failed to unsubscribe from mix for {subscriber_id} in room {room_id}: {e}")
        finally:
            self._mix_subs.pop(subscriber_id, None)

    # ── health check ─────────────────────────────────────────────────────
    async def health_check(self) -> bool:
        """Check if the audio service connection is healthy."""
        try:
            if not self._client.connected:
                return False
            await self._connected.wait()
            return True
        except Exception as e:
            log.error(f"Audio service health check failed: {e}")
            return False

    # ── downlink handlers (from audio) ──────────────────────────────────
    async def _on_connect(self) -> None:
        log.info("audio connected: %s", self.url)
        self._connected.set()

    async def _on_disconnect(self) -> None:
        log.warning("audio disconnected")
        self._connected.clear()

    async def _on_text_chunk(self, payload: Dict[str, Any]) -> None:
        try:
            room_id = payload.get("room_id")
            if isinstance(room_id, str):
                # rebroadcast to browser clients joined to the same room_id
                await self.server_sio.emit("text_chunk", payload, room=room_id)
        except Exception:
            log.exception("failed to forward text_chunk")

    async def _on_transcript(self, payload: Dict[str, Any]) -> None:
        try:
            room_id = payload.get("room_id")
            if isinstance(room_id, str):
                await self.server_sio.emit("transcript", payload, room=room_id)
        except Exception:
            log.exception("failed to forward transcript")

    async def _on_transcript_stop(self, payload: Dict[str, Any]) -> None:
        try:
            room_id = payload.get("room_id")
            if isinstance(room_id, str):
                await self.server_sio.emit("transcript_stop", payload, room=room_id)
        except Exception:
            log.exception("failed to forward transcript_stop")

    async def _on_s2s_mixed_frame(self, payload: Dict[str, Any]) -> None:
        try:
            sid = str(payload.get("subscriber_id")) if payload.get("subscriber_id") is not None else ""
            raw = payload.get("frame_b64")
            if not sid or not isinstance(raw, str):
                return
            data = base64.b64decode(raw)
            pcm = np.frombuffer(data, dtype=np.int16)
            sub = self._mix_subs.get(sid)
            if sub:
                await sub.send_i16(pcm)
        except Exception:
            log.exception("failed to handle s2s_mixed_frame")


_BRIDGE_SINGLETON: Optional[AudioBridge] = None


def get_bridge(server_sio: socketio.AsyncServer) -> AudioBridge:
    global _BRIDGE_SINGLETON
    if _BRIDGE_SINGLETON is None:
        _BRIDGE_SINGLETON = AudioBridge(server_sio)
    return _BRIDGE_SINGLETON



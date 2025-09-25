# server/app/rtc.py
# WebRTC primitives extracted from newmain.py for reuse
import asyncio
import json
import logging
import os
from collections.abc import Awaitable, Callable
from fractions import Fraction
from typing import Any

logger = logging.getLogger(__name__)

import av  # type: ignore
import numpy as np
from aiortc import RTCConfiguration  # type: ignore
from aiortc import (MediaStreamTrack, RTCDataChannel, RTCIceServer,
                    RTCPeerConnection, RTCSessionDescription)

from .bus import PCM_SR, SAMPLES_PER_CHUNK, Subscriber
from .room import get_room
from .utils.audio_convert import frame_to_i16_mono_safe

# ── Emitter hook for RTC layer ─────────────────────────────────────────────────
_emit_to_sid: Callable[[str, str, dict], Awaitable[None]] | None = None


def set_emitter(fn: Callable[[str, str, dict], Awaitable[None]]) -> None:
    global _emit_to_sid
    _emit_to_sid = fn


def build_ice_servers() -> list[RTCIceServer]:
    def parse_csv(env: str) -> list[str]:
        return [u.strip() for u in os.getenv(env, "").split(",") if u.strip()]

    stun_uris = parse_csv("STUN_URI")
    turn_uris = parse_csv("TURN_URI")
    username = os.getenv("TURN_USERNAME")
    credential = os.getenv("TURN_PASSWORD")

    servers = []
    if stun_uris:
        servers.append(RTCIceServer(urls=stun_uris))
    if turn_uris and username and credential:
        servers.append(
            RTCIceServer(urls=turn_uris, username=username, credential=credential)
        )
    return servers


class OutboundTrack(MediaStreamTrack):
    kind = "audio"

    def __init__(self, sub: Subscriber) -> None:
        super().__init__()
        self.sub = sub
        self._ts = 0

    async def recv(self) -> av.AudioFrame:
        # get exactly the next frame in order
        chunk = await self.sub.recv()

        pcm_i16 = (np.clip(chunk.data, -1, 1) * 32767).astype(np.int16)
        if len(pcm_i16) < SAMPLES_PER_CHUNK:
            pcm_i16 = np.pad(pcm_i16, (0, SAMPLES_PER_CHUNK - len(pcm_i16)))
        elif len(pcm_i16) > SAMPLES_PER_CHUNK:
            pcm_i16 = pcm_i16[:SAMPLES_PER_CHUNK]

        frame = av.AudioFrame(format="s16", layout="mono", samples=SAMPLES_PER_CHUNK)
        frame.planes[0].update(pcm_i16.tobytes())
        frame.sample_rate = PCM_SR
        frame.pts = self._ts
        frame.time_base = Fraction(1, PCM_SR)
        self._ts += SAMPLES_PER_CHUNK
        return frame


class WebRTCSession:
    def __init__(self, sid: str, room_id: str):
        self.sid = sid
        self.pc = RTCPeerConnection(
            configuration=RTCConfiguration(iceServers=build_ice_servers())
        )
        self.room = get_room(room_id)
        self.room.register_agent(self.sid, "human")
        # Mark human presence (lazy start OpenAI if first human)
        try:
            asyncio.create_task(self.room.human_join(self.sid))
        except Exception:
            pass
        # Seed the parent cursor to the latest assistant message so live mic
        # transcripts thread correctly even before any explicit parent is sent.
        async def _seed_parent_cursor() -> None:
            try:
                from app.db import get_session
                from app.models import Messages
                from sqlalchemy import text as _text
                from sqlmodel import select

                db = next(get_session())
                try:
                    # Use raw ORDER BY to avoid typing issues
                    row = db.exec(
                        select(Messages)
                        .where(Messages.chat_id == room_id, Messages.role == "assistant")
                        .order_by(_text("created_at DESC"))
                    ).first()
                    if row:
                        self.room.set_parent_id(str(row.id))
                finally:
                    try:
                        db.close()
                    except Exception:
                        pass
            except Exception:
                # best-effort; safe to ignore
                pass
        asyncio.create_task(_seed_parent_cursor())
        self.subscriber = self.room.bus.subscribe(self.sid)
        self.out_track = OutboundTrack(self.subscriber)

        self._consumer_task: asyncio.Task | None = None
        self._text_task: asyncio.Task | None = None
        self._text_channel: RTCDataChannel | None = None
        self._pending_ice: list[dict | None] = []

        @self.pc.on("track")
        async def on_track(track: MediaStreamTrack) -> None:
            logger.debug(f"[RTC] got track kind={track.kind}")
            if track.kind != "audio":
                return

            # tell client "audio bridge ready" (your UI uses this)
            if _emit_to_sid:
                # lazy import to avoid circular
                from app.main import get_profile_id_for_sid

                pid = get_profile_id_for_sid(self.sid)
                await _emit_to_sid(self.sid, "webrtc_audio_ready", {"profile_id": pid})

            async def consume() -> None:
                buf = np.empty(0, dtype=np.int16)
                frames = 0
                while True:
                    frame = await track.recv()
                    frames += 1
                    if frames % 50 == 0:
                        logger.debug(
                            f"[RTC] inbound audio frame sr={frame.sample_rate} samples={frame.samples}"
                        )
                    pcm_i16 = frame_to_i16_mono_safe(frame)
                    buf = np.concatenate([buf, pcm_i16])
                    while len(buf) >= SAMPLES_PER_CHUNK:
                        chunk = buf[:SAMPLES_PER_CHUNK]
                        buf = buf[SAMPLES_PER_CHUNK:]
                        await self.room.bus.ingest_i16(
                            self.sid, chunk, PCM_SR
                        )  # prints [BUS] ingest ...

            self._consumer_task = asyncio.create_task(consume())

        @self.pc.on("datachannel")
        def on_datachannel(ch: RTCDataChannel) -> None:
            logger.debug(f"[RTC] datachannel label={ch.label}")
            if ch.label != "text":
                return
            self._text_channel = ch

            @ch.on("message")
            async def on_msg(raw: Any) -> None:
                try:
                    obj = json.loads(
                        raw if isinstance(raw, str) else raw.decode("utf-8")
                    )
                except Exception:
                    obj = {"text": str(raw), "chunk_idx": 0, "is_final": True}

                # Prefer the training pipeline when a chat_id is provided
                chat_id = obj.get("chat_id")
                text = obj.get("text", "")
                is_final = bool(obj.get("is_final", True))

                if chat_id and text and is_final:
                    # lazy imports to avoid circulars
                    from app.main import get_profile_id_for_sid
                    from app.web.training import handle_send_training_message

                    profile_id = get_profile_id_for_sid(self.sid)

                    # Fire-and-forget the training handler
                    async def _bg() -> None:
                        try:
                            await handle_send_training_message(
                                sid=self.sid,
                                data={
                                    "chat_id": str(chat_id),
                                    "message": text,
                                    "source": "rtc",
                                    # Thread parent override if client requests a branch
                                    "parent_id": obj.get("parent_id"),
                                },
                            )
                        except Exception:
                            import logging

                            logging.getLogger(__name__).exception(
                                "training handler failed"
                            )

                    asyncio.create_task(_bg())
                    return

                # Get parent_id from client data
                parent_id = obj.get("parent_id")
                if parent_id:
                    # Set the parent_id on the room for this and future messages
                    self.room.set_parent_id(parent_id)

                # fallback: if no chat_id or not final, keep existing room append (optional)
                await self.room.append_text_chunk(
                    source_id=self.sid,
                    role="user",
                    text=text,
                    message_id=obj.get("message_id"),
                    chunk_idx=int(obj.get("chunk_idx", 0)),
                    is_final=is_final,
                    persona_id=None,  # No persona for fallback cases
                )

    async def handle_offer(self, offer: dict[str, Any]) -> dict[str, str]:
        self.pc.addTrack(self.out_track)
        await self.pc.setRemoteDescription(
            RTCSessionDescription(sdp=offer["sdp"], type=offer["type"])
        )
        for cand in self._pending_ice:
            await self._add_ice_internal(cand)
        self._pending_ice.clear()
        ans = await self.pc.createAnswer()
        await self.pc.setLocalDescription(ans)
        while self.pc.iceGatheringState != "complete":
            await asyncio.sleep(0.02)
        return {"type": "answer", "sdp": self.pc.localDescription.sdp}

    async def add_ice(self, candidate: dict[str, Any] | None) -> None:
        if self.pc.remoteDescription is None:
            self._pending_ice.append(candidate)
        else:
            await self._add_ice_internal(candidate)

    async def _add_ice_internal(self, cand: dict[str, Any] | None) -> None:
        if not cand:
            return
        from aiortc.sdp import candidate_from_sdp  # type: ignore

        c = candidate_from_sdp(cand.get("candidate", ""))
        if "sdpMid" in cand:
            c.sdpMid = str(cand["sdpMid"])
        if "sdpMLineIndex" in cand:
            c.sdpMLineIndex = int(cand["sdpMLineIndex"])
        if c.sdpMid is None and c.sdpMLineIndex is None:
            c.sdpMLineIndex = 0
        await self.pc.addIceCandidate(c)

    async def close(self) -> None:
        try:
            if self._consumer_task:
                self._consumer_task.cancel()
            if self._text_task:
                self._text_task.cancel()
            await self.pc.close()
        finally:
            self.room.bus.unsubscribe(self.sid)
            # On RTC disconnect, update human presence and possibly stop OpenAI
            try:
                await self.room.human_leave(self.sid)
            except Exception:
                pass


# Global session storage
sessions: dict[str, WebRTCSession] = {}

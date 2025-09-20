# server/app/rtc.py
# WebRTC primitives extracted from newmain.py for reuse
import asyncio
import json
import logging
import os
from fractions import Fraction
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger(__name__)

import av  # type: ignore
import numpy as np
from aiortc import (MediaStreamTrack, RTCConfiguration,  # type: ignore
                    RTCDataChannel, RTCIceServer, RTCPeerConnection,
                    RTCSessionDescription)
from app.bridge import MixedAudioSubscriber, get_bridge

from .utils.audio_convert import frame_to_i16_mono_safe

# Audio constants
PCM_SR = 48_000
SAMPLES_PER_CHUNK = 960  # 20ms @ 48k mono

# ── Emitter hook for RTC layer ─────────────────────────────────────────────────
_emit_to_sid: Optional[Callable[[str, str, dict], Awaitable[None]]] = None

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
        servers.append(RTCIceServer(urls=turn_uris,
                                    username=username,
                                    credential=credential))
    return servers

class OutboundTrack(MediaStreamTrack):
    kind = "audio"

    def __init__(self, mixed_subscriber: MixedAudioSubscriber):
        super().__init__()
        self._sub = mixed_subscriber
        self._ts = 0

    async def recv(self) -> av.AudioFrame:
        pcm_i16 = await self._sub.recv_i16()
        if pcm_i16.size < SAMPLES_PER_CHUNK:
            pcm_i16 = np.pad(pcm_i16, (0, SAMPLES_PER_CHUNK - pcm_i16.size))
        elif pcm_i16.size > SAMPLES_PER_CHUNK:
            pcm_i16 = pcm_i16[:SAMPLES_PER_CHUNK]
        frame = av.AudioFrame(format="s16", layout="mono", samples=SAMPLES_PER_CHUNK)
        frame.planes[0].update(pcm_i16.tobytes())
        frame.sample_rate = PCM_SR
        frame.pts = self._ts
        frame.time_base = Fraction(1, PCM_SR)
        self._ts += SAMPLES_PER_CHUNK
        return frame

class WebRTCSession:
    def __init__(self, sid: str, room_id: str, human_id: str):
        self.sid = sid
        self.room_id = room_id
        self.human_id = human_id
        self.pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=build_ice_servers()))
        self._mixed_sub: Optional[MixedAudioSubscriber] = None
        self.out_track: Optional[OutboundTrack] = None

        self._consumer_task: Optional[asyncio.Task] = None
        self._text_task: Optional[asyncio.Task] = None
        self._text_channel: Optional[RTCDataChannel] = None
        self._pending_ice: list[dict|None] = []

        @self.pc.on("track")
        async def on_track(track: MediaStreamTrack) -> None:
            logger.debug(f"[RTC] got track kind={track.kind}")
            if track.kind != "audio": return

            async def consume() -> None:
                buf = np.empty(0, dtype=np.int16)
                frames = 0
                while True:
                    frame = await track.recv()
                    frames += 1
                    if frames % 50 == 0:
                        logger.debug(f"[RTC] inbound audio frame sr={frame.sample_rate} samples={frame.samples}")
                    pcm_i16 = frame_to_i16_mono_safe(frame)
                    buf = np.concatenate([buf, pcm_i16])
                    while len(buf) >= SAMPLES_PER_CHUNK:
                        chunk = buf[:SAMPLES_PER_CHUNK]; buf = buf[SAMPLES_PER_CHUNK:]
                        # Send to audio-multi
                        try:
                            from app.main import get_socketio_instance
                            bridge = get_bridge(get_socketio_instance())
                            await bridge.ingest_frame(room_id=self.room_id, source_id=self.human_id, pcm_i16=chunk, sr=PCM_SR)
                        except Exception:
                            logger.exception("audio-multi ingest failed")
            self._consumer_task = asyncio.create_task(consume())

        @self.pc.on("datachannel")
        def on_datachannel(ch: RTCDataChannel) -> None:
            logger.debug(f"[RTC] datachannel label={ch.label}")
            if ch.label != "text": 
                return
            self._text_channel = ch

            @ch.on("message")
            async def on_msg(raw: str | bytes) -> None:
                try:
                    obj = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
                except Exception:
                    obj = {"text": str(raw), "chunk_idx": 0, "is_final": True}

                # Prefer the training pipeline when a chat_id is provided
                chat_id = obj.get("chat_id")
                text = obj.get("text", "")
                is_final = bool(obj.get("is_final", True))

                if chat_id and text and is_final:
                    # lazy imports to avoid circulars
                    from app.bridge import get_bridge
                    from app.main import (get_profile_id_for_sid,
                                          get_socketio_instance)
                    from app.utils.chat import get_audio_config
                    from app.web.training import handle_send_training_message

                    profile_id = get_profile_id_for_sid(self.sid)
                    # Decide path: if exactly one agent and one human (2 participants), send direct text to agent
                    # Otherwise, use normal training pipeline (which can route via TTS/bus or agent flow as designed)
                    config = get_audio_config(str(chat_id))
                    agents = config.get("agents", []) if isinstance(config, dict) else []
                    # two-party means exactly one agent persona and exactly one user (this session)
                    num_agent_personas = len([a for a in agents if not a.get("user")])
                    num_user_personas = len([a for a in agents if a.get("user")])
                    is_two_party = (num_agent_personas == 1 and num_user_personas == 1)

                    async def _bg() -> None:
                        try:
                            if is_two_party:
                                # Prefer direct agent text: instruct audio service to route text-only, and also try direct send on the agent session.
                                try:
                                    bridge = get_bridge(get_socketio_instance())
                                    # Signal audio to suppress TTS and deliver as text to model
                                    await bridge._client.emit("s2s_user_text", bridge._with_auth({
                                        "room_id": self.room_id,
                                        "human_id": self.human_id,
                                        "text": text,
                                        "text_only": True,
                                    }))
                                except Exception:
                                    logger.exception("audio text_only path failed")
                                # Do not emit s2s_user_text a second time; audio service will route to agent session
                            else:
                                await handle_send_training_message(
                                    sid=self.sid,
                                    data={"chat_id": str(chat_id), "message": text, "source": "rtc"},
                                )
                        except Exception:
                            import logging
                            logging.getLogger(__name__).exception("training handler failed")
                    asyncio.create_task(_bg())
                    return

                # fallback: no-op or optionally forward as s2s_user_text
                if text and is_final:
                    try:
                        from app.main import get_socketio_instance
                        bridge = get_bridge(get_socketio_instance())
                        await bridge._client.emit("s2s_user_text", bridge._with_auth({
                            "room_id": self.room_id,
                            "human_id": self.human_id,
                            "text": text,
                        }))
                    except Exception:
                        logger.exception("audio-multi user_text failed")

    async def handle_offer(self, offer: Dict[str, Any]) -> Dict[str, str]:
        if self.out_track is not None:
            self.pc.addTrack(self.out_track)
        await self.pc.setRemoteDescription(RTCSessionDescription(sdp=offer["sdp"], type=offer["type"]))
        for cand in self._pending_ice: await self._add_ice_internal(cand)
        self._pending_ice.clear()
        ans = await self.pc.createAnswer(); await self.pc.setLocalDescription(ans)
        while self.pc.iceGatheringState != "complete": await asyncio.sleep(0.02)
        return {"type": "answer", "sdp": self.pc.localDescription.sdp}

    async def add_ice(self, candidate: Optional[Dict[str, Any]]) -> None:
        if self.pc.remoteDescription is None: self._pending_ice.append(candidate)
        else: await self._add_ice_internal(candidate)

    async def _add_ice_internal(self, cand: Optional[Dict[str, Any]]) -> None:
        if not cand: return
        from aiortc.sdp import candidate_from_sdp  # type: ignore
        c = candidate_from_sdp(cand.get("candidate",""))
        if "sdpMid" in cand: c.sdpMid = str(cand["sdpMid"])
        if "sdpMLineIndex" in cand: c.sdpMLineIndex = int(cand["sdpMLineIndex"])
        if c.sdpMid is None and c.sdpMLineIndex is None: c.sdpMLineIndex = 0
        await self.pc.addIceCandidate(c)

    async def close(self) -> None:
        try:
            if self._consumer_task: self._consumer_task.cancel()
            if self._text_task: self._text_task.cancel()
            await self.pc.close()
        finally:
            # Unsubscribe mixed audio
            try:
                if self._mixed_sub is not None:
                    from app.main import get_socketio_instance
                    bridge = get_bridge(get_socketio_instance())
                    await bridge.unsubscribe_mix(room_id=self.room_id, subscriber_id=self.sid)
            except Exception:
                pass

    async def init_mixed_audio(self) -> None:
        try:
            from app.main import get_socketio_instance
            bridge = get_bridge(get_socketio_instance())
            sub = await bridge.subscribe_mix(room_id=self.room_id, subscriber_id=self.sid)
            self._mixed_sub = sub
            self.out_track = OutboundTrack(sub)
        except Exception:
            logger.exception("failed to subscribe mixed audio")

# Global session storage
sessions: Dict[str, WebRTCSession] = {}

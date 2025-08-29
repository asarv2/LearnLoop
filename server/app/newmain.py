# Suppress warnings before any imports
import asyncio
import json
import os
from fractions import Fraction
from typing import Any, Dict, Optional

import av  # type: ignore
import numpy as np
import socketio  # type: ignore
from aiortc import (MediaStreamTrack, RTCConfiguration,  # type: ignore
                    RTCDataChannel, RTCIceServer, RTCPeerConnection,
                    RTCSessionDescription)
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .bus import PCM_SR, SAMPLES_PER_CHUNK
from .room import get_room  
from .utils.audio_convert import frame_to_i16_mono_safe

load_dotenv()

origin = os.getenv("ORIGIN", "http://localhost:3000")
allowed_origins = [origin]

# --- Config ---
AUDIO_SR = 48000  # Opus default
AUDIO_CH = 1

def build_ice_servers():
    def parse_csv(env):
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

fastapi_app = FastAPI(title="RTC")
fastapi_app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=allowed_origins, transports=['websocket','polling'])
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")

class OutboundTrack(MediaStreamTrack):
    kind = "audio"
    def __init__(self, sub): super().__init__(); self.sub = sub; self._ts = 0
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
        self.pc = RTCPeerConnection(configuration=RTCConfiguration(iceServers=build_ice_servers()))
        self.room = get_room(room_id)
        self.room.register_agent(self.sid, "human")
        self.subscriber = self.room.bus.subscribe(self.sid)
        self.out_track = OutboundTrack(self.subscriber)

        self._consumer_task: Optional[asyncio.Task] = None
        self._text_task: Optional[asyncio.Task] = None
        self._text_channel: Optional[RTCDataChannel] = None
        self._pending_ice: list[dict|None] = []

        @self.pc.on("track")
        async def on_track(track: MediaStreamTrack):
            print(f"[RTC] got track kind={track.kind}")
            if track.kind != "audio": return
            async def consume():
                buf = np.empty(0, dtype=np.int16)
                frames = 0
                while True:
                    frame = await track.recv()
                    frames += 1
                    if frames % 50 == 0:
                        print(f"[RTC] inbound audio frame sr={frame.sample_rate} samples={frame.samples}")
                    pcm_i16 = frame_to_i16_mono_safe(frame)
                    buf = np.concatenate([buf, pcm_i16])
                    while len(buf) >= SAMPLES_PER_CHUNK:
                        chunk = buf[:SAMPLES_PER_CHUNK]; buf = buf[SAMPLES_PER_CHUNK:]
                        await self.room.bus.ingest_i16(self.sid, chunk, PCM_SR)  # prints [BUS] ingest ...
            self._consumer_task = asyncio.create_task(consume())

        @self.pc.on("datachannel")
        def on_datachannel(ch: RTCDataChannel):
            print(f"[RTC] datachannel label={ch.label}")
            if ch.label != "text": return
            self._text_channel = ch
            @ch.on("message")
            async def on_msg(raw):
                try:
                    obj = json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
                except Exception:
                    obj = {"text": str(raw), "chunk_idx": 0, "is_final": True}

                await self.room.append_text_chunk(
                    source_id=self.sid, role="user",
                    text=obj.get("text",""),
                    message_id=obj.get("message_id"),
                    chunk_idx=int(obj.get("chunk_idx", 0)),
                    is_final=bool(obj.get("is_final", True)),
                )

    async def handle_offer(self, offer: Dict[str, Any]):
        self.pc.addTrack(self.out_track)
        await self.pc.setRemoteDescription(RTCSessionDescription(sdp=offer["sdp"], type=offer["type"]))
        for cand in self._pending_ice: await self._add_ice_internal(cand)
        self._pending_ice.clear()
        ans = await self.pc.createAnswer(); await self.pc.setLocalDescription(ans)
        while self.pc.iceGatheringState != "complete": await asyncio.sleep(0.02)
        return {"type": "answer", "sdp": self.pc.localDescription.sdp}

    async def add_ice(self, candidate: Optional[Dict[str, Any]]):
        if self.pc.remoteDescription is None: self._pending_ice.append(candidate)
        else: await self._add_ice_internal(candidate)

    async def _add_ice_internal(self, cand: Optional[Dict[str, Any]]):
        if not cand: return
        from aiortc.sdp import candidate_from_sdp
        c = candidate_from_sdp(cand.get("candidate",""))
        if "sdpMid" in cand: c.sdpMid = str(cand["sdpMid"])
        if "sdpMLineIndex" in cand: c.sdpMLineIndex = int(cand["sdpMLineIndex"])
        if c.sdpMid is None and c.sdpMLineIndex is None: c.sdpMLineIndex = 0
        await self.pc.addIceCandidate(c)

    async def close(self):
        try:
            if self._consumer_task: self._consumer_task.cancel()
            if self._text_task: self._text_task.cancel()
            await self.pc.close()
        finally:
            self.room.bus.unsubscribe(self.sid)

sessions: Dict[str, WebRTCSession] = {}

@sio.event
async def connect(sid, environ, auth):
    return True

@sio.event
async def disconnect(sid):
    s = sessions.pop(sid, None)
    if s:
        # optional but tidy: remove from the Socket.IO room
        await sio.leave_room(sid, s.room.id)
        await s.close()

@sio.event
async def offer(sid, data):
    print(f"[SOCK] offer from {sid} room={data.get('room_id')}")
    room_id = data.get("room_id") or get_room().id

    await sio.enter_room(sid, room_id)
    room = get_room(room_id)

    # 👇 set this once per room (idempotent)
    if room.on_text_chunk is None:
        async def _broadcast(payload):
            await sio.emit("text_chunk", payload, room=room.id)
        room.on_text_chunk = _broadcast

    if sid not in sessions:
        sessions[sid] = WebRTCSession(sid, room_id)

    ans = await sessions[sid].handle_offer(data)
    await sio.emit("answer", ans, room=sid)

@sio.event
async def ice_candidate(sid, data):
    if sid in sessions:
        await sessions[sid].add_ice(data.get("candidate"))

# Add health check endpoint
@fastapi_app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn  # type: ignore

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )
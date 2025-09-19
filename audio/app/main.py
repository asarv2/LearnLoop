from __future__ import annotations

import asyncio
import json
import os
from typing import Dict, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from .bus import PCM_SR, SAMPLES_PER_CHUNK, AudioBus, AudioChunk

app = FastAPI(title="Learnloop Audio Service", version="0.1.0")


# In-memory room registry
class RoomState:
    def __init__(self, room_id: str):
        self.id = room_id
        self.bus = AudioBus()
        self.bus.start(period_ms=20)


ROOMS: Dict[str, RoomState] = {}


def get_room(room_id: str) -> RoomState:
    r = ROOMS.get(room_id)
    if r is None:
        r = RoomState(room_id)
        ROOMS[room_id] = r
    return r


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/rooms")
async def create_room(payload: dict) -> dict:
    room_id = str(payload.get("room_id") or os.urandom(6).hex())
    _ = get_room(room_id)
    return {"room_id": room_id}


@app.delete("/rooms/{room_id}")
async def delete_room(room_id: str) -> JSONResponse:
    r = ROOMS.pop(room_id, None)
    if r:
        await r.bus.stop()
    return JSONResponse(status_code=204, content=None)


@app.post("/rooms/{room_id}/ignore")
async def set_ignore(room_id: str, payload: dict) -> dict:
    sub_id = payload.get("subscriber_id")
    sources = set(payload.get("sources", []))
    if not sub_id:
        raise HTTPException(status_code=400, detail="missing subscriber_id")
    r = get_room(room_id)
    r.bus.set_ignore(sub_id, sources)
    return {"ok": True}


@app.websocket("/ws/ingest")
async def ws_ingest(ws: WebSocket) -> None:
    await ws.accept()
    try:
        # First message must be JSON handshake
        raw = await ws.receive_text()
        meta = json.loads(raw)
        room_id = str(meta.get("room_id"))
        source_id = str(meta.get("source_id"))
        sr = int(meta.get("sr", PCM_SR))
        chunk = int(meta.get("chunk_samples", SAMPLES_PER_CHUNK))
        if not room_id or not source_id:
            await ws.close(code=4000)
            return
        if sr != PCM_SR or chunk != SAMPLES_PER_CHUNK:
            # For MVP enforce exact format
            await ws.close(code=4001)
            return
        room = get_room(room_id)

        while True:
            msg = await ws.receive_bytes()
            # Expect raw PCM16 little-endian mono of length 2*chunk
            if len(msg) != 2 * SAMPLES_PER_CHUNK:
                continue
            pcm_i16 = np.frombuffer(msg, dtype=np.int16)
            await room.bus.ingest_i16(source_id, pcm_i16, PCM_SR)
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await ws.close(code=1011)
        except Exception:
            pass


@app.websocket("/ws/subscribe")
async def ws_subscribe(ws: WebSocket) -> None:
    await ws.accept()
    sub_id: Optional[str] = None
    room_id_for_cleanup: Optional[str] = None
    try:
        raw = await ws.receive_text()
        meta = json.loads(raw)
        room_id = str(meta.get("room_id"))
        sub_id = str(meta.get("subscriber_id"))
        sr = int(meta.get("sr", PCM_SR))
        chunk = int(meta.get("chunk_samples", SAMPLES_PER_CHUNK))
        if not room_id or not sub_id:
            await ws.close(code=4000)
            return
        if sr != PCM_SR or chunk != SAMPLES_PER_CHUNK:
            await ws.close(code=4001)
            return
        room = get_room(room_id)
        room_id_for_cleanup = room_id
        sub = room.bus.subscribe(sub_id)

        while True:
            ch: AudioChunk = await sub.recv()
            # send as raw PCM16 bytes
            pcm_i16 = (np.clip(ch.data, -1, 1) * 32767.0).astype(np.int16)
            await ws.send_bytes(pcm_i16.tobytes())
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await ws.close(code=1011)
        except Exception:
            pass
    finally:
        if sub_id and room_id_for_cleanup:
            try:
                r_opt = ROOMS.get(room_id_for_cleanup)
                if r_opt is not None:
                    r_opt.bus.unsubscribe(sub_id)
            except Exception:
                pass



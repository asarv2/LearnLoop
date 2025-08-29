# store.py
from __future__ import annotations

import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Dict, List, Optional


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

@dataclass
class TextChunk:
    message_id: str
    chunk_idx: int
    text: str
    is_final: bool
    ts_ms: int

@dataclass
class Message:
    id: str
    source_id: str           # session id or agent id
    role: str                # "user" | "agent" | "system"
    created_ms: int
    chunks: List[TextChunk] = field(default_factory=list)

@dataclass
class RoomRecord:
    id: str
    created_ms: int
    messages: "OrderedDict[str, Message]" = field(default_factory=OrderedDict)

# --- global in-memory store ---
ROOMS: Dict[str, RoomRecord] = {}

def create_room(room_id: Optional[str] = None) -> RoomRecord:
    rid = room_id or gen_id("room")
    rec = RoomRecord(id=rid, created_ms=int(time.time()*1000))
    ROOMS[rid] = rec
    return rec

def get_room(room_id: str) -> RoomRecord:
    return ROOMS.setdefault(room_id, create_room(room_id))

def upsert_text_chunk(room_id: str, *, message_id: Optional[str], source_id: str, role: str,
                      text: str, chunk_idx: int, is_final: bool) -> Message:
    room = get_room(room_id)
    mid = message_id or gen_id("msg")
    msg = room.messages.get(mid)
    if msg is None:
        msg = Message(id=mid, source_id=source_id, role=role, created_ms=int(time.time()*1000))
        room.messages[mid] = msg
    msg.chunks.append(TextChunk(message_id=mid, chunk_idx=chunk_idx, text=text,
                                is_final=is_final, ts_ms=int(time.time()*1000)))
    if not message_id:
        print("genereated new message:", text)
    return msg

def list_messages(room_id: str) -> List[Message]:
    room = get_room(room_id)
    return list(room.messages.values())



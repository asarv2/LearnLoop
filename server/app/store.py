# store.py
from __future__ import annotations

import logging
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Dict, List, Optional, Tuple
from uuid import UUID

from app.db import get_session
from app.models import Chats
from app.models import Messages as DBMessage
from sqlmodel import select


def _uuid_or_none(x):
    """Safely convert string to UUID, return None if invalid."""
    try: 
        return UUID(x) if x else None
    except Exception: 
        return None

logger = logging.getLogger(__name__)


def gen_id(prefix: str | None = None) -> str:
    # Always return a hyphenated UUID string so DB can accept it.
    return str(uuid.uuid4())

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

def list_messages(room_id: str) -> List[Message]:
    room = get_room(room_id)
    return list(room.messages.values())

# ---- event emitter plumbing (set by main) ------------------------------------
_emit: Optional[Callable[[str, str, dict], Awaitable[None]]] = None
def set_emitter(emitter):
    """
    emitter: async def (room_or_sid: str, event: str, payload: dict) -> None
    For our use we call with room_id (Socket.IO room).
    """
    global _emit
    _emit = emitter

# ---- persistence helpers -----------------------------------------------------

def _ensure_chat_exists(db, chat_id: str) -> Optional[Chats]:
    # Optional safety; if your chat rows always exist, you can skip this lookup
    try:
        return db.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
    except Exception:
        return None

def _upsert_db_message(
    db, *, chat_id: str, role: str, msg_id: str, text: str,
    is_final: bool, persona_id: Optional[str] = None
) -> Tuple[DBMessage, str]:
    """
    Create/update a DB message row. We store the concatenated content so fetches are simple.
    Returns (db_message, accumulated_text).
    """
    m: Optional[DBMessage] = db.exec(select(DBMessage).where(DBMessage.id == msg_id)).one_or_none()
    now = time.time()

    if m is None:
        # Create new DB message row
        m = DBMessage(
            id=UUID(msg_id),   # msg_id is already a valid UUID string now
            chat_id=chat_id,
            role="assistant" if role == "agent" else "user",
            content=text or "",
            completed=is_final,
            persona_id=_uuid_or_none(persona_id),
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        acc = m.content or ""
    else:
        # Append chunk text
        acc = (m.content or "") + (text or "")
        m.content = acc
        if is_final:
            m.completed = True
        db.add(m)
        db.commit()
        db.refresh(m)

    return m, acc

# ---- main function used by Room.append_text_chunk ----------------------------

async def upsert_text_chunk(
    room_id: str, *,
    message_id: Optional[str],
    source_id: str,
    role: str,
    text: str,
    chunk_idx: int,
    is_final: bool,
    persona_id: Optional[str] = None,   # optional: allow caller to tag persona
) -> Message:
    """
    1) Update in-memory store (for streaming UX)
    2) Persist to DB Messages table (accumulated text, completed flag)
    3) Emit training DOM-friendly events via Socket.IO
    """
    room = get_room(room_id)
    mid = message_id or gen_id(None)  # first chunk gets a UUID, later chunks reuse the same message_id
    msg = room.messages.get(mid)
    created_ms_now = int(time.time()*1000)

    first_chunk = False
    if msg is None:
        msg = Message(id=mid, source_id=source_id, role=role, created_ms=created_ms_now)
        room.messages[mid] = msg
        first_chunk = True
        logger.debug(f"Created new message: mid={mid}, role={role}, chunk_idx={chunk_idx}")
    else:
        logger.debug(f"Reusing message: mid={mid}, role={role}, chunk_idx={chunk_idx}, is_final={is_final}")

    # append in-memory chunk
    msg.chunks.append(TextChunk(
        message_id=mid, chunk_idx=chunk_idx, text=text,
        is_final=is_final, ts_ms=created_ms_now
    ))

    # Persist (write-through) - push DB I/O to a thread
    import asyncio
    def _persist_once():
        db = next(get_session())
        try:
            _ensure_chat_exists(db, room_id)
            return _upsert_db_message(
                db,
                chat_id=room_id, role=role, msg_id=mid,
                text=text, is_final=is_final, persona_id=persona_id
            )
        except Exception:
            # Make sure the aborted txn is rolled back before returning the conn to the pool
            try: db.rollback()
            except Exception: pass
            raise
        finally:
            try: db.close()
            except Exception: pass

    db_msg, acc = await asyncio.to_thread(_persist_once)

    # Emit events your frontend already expects
    if _emit:
        if role == "user":
            # only once per user message
            if first_chunk:
                await _emit(room_id, "user_message_saved", {
                    "chat_id": room_id,
                    "message": {
                        "id": str(db_msg.id),
                        "chat_id": str(db_msg.chat_id),
                        "role": db_msg.role,
                        "content": db_msg.content or "",
                        "completed": db_msg.completed,
                        "created_at": db_msg.created_at.isoformat(),
                        "completed_at": db_msg.completed_at.isoformat() if db_msg.completed_at else None,
                        "persona_id": str(db_msg.persona_id) if db_msg.persona_id else None,
                    }
                })
        else:
            # assistant stream
            if first_chunk and not is_final:
                await _emit(room_id, "training_message_start", {
                    "chat_id": room_id,
                    "message_id": str(db_msg.id),
                    "persona_id": str(db_msg.persona_id) if db_msg.persona_id else None,
                })

            if not is_final:
                await _emit(room_id, "training_message_token", {
                    "chat_id": room_id,
                    "message_id": str(db_msg.id),
                    "token": text or "",
                    "accumulated_content": acc,
                })
            else:
                await _emit(room_id, "training_message_complete", {
                    "chat_id": room_id,
                    "message_id": str(db_msg.id),
                    "final_content": acc,
                })

    return msg



# store.py
from __future__ import annotations

import logging
import time
import uuid
from collections import OrderedDict, defaultdict
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple, cast
from uuid import UUID

from app.db import get_session
from app.models import Chats
from app.models import Messages as DBMessage
from app.services.agents.hint import run_hint_agent
from sqlmodel import select

# test comment

def _uuid_or_none(x: str | None) -> UUID | None:
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
    persona_id: Optional[str] = None

@dataclass
class RoomRecord:
    id: str
    created_ms: int
    messages: "OrderedDict[str, Message]" = field(default_factory=OrderedDict)

# --- global in-memory store ---
ROOMS: Dict[str, RoomRecord] = {}

# --- idempotency guards for multi-worker safety ---
STARTED: set[str] = set()  # tracks which messages have emitted "start"

# --- batched DB writes ---
PENDING_WRITES: Dict[str, List[str]] = defaultdict(list)  # message_id -> list of text chunks
LAST_FLUSH: Dict[str, float] = {}  # message_id -> last flush timestamp
FLUSH_INTERVAL = 0.2  # 200ms between flushes

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
def set_emitter(emitter: Callable[[str, str, dict], Awaitable[None]]) -> None:
    """
    emitter: async def (room_or_sid: str, event: str, payload: dict) -> None
    For our use we call with room_id (Socket.IO room).
    """
    global _emit
    _emit = emitter

# ---- persistence helpers -----------------------------------------------------

def _ensure_chat_exists(db: Any, chat_id: str) -> Optional[Chats]:
    # Optional safety; if your chat rows always exist, you can skip this lookup
    try:
        return cast(Optional[Chats], db.exec(select(Chats).where(Chats.id == chat_id)).one_or_none())
    except Exception:
        return None

def _upsert_db_message(
    db: Any, *, chat_id: str, role: str, msg_id: str, text: str,
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

# ---- batched DB write helpers ----

async def _flush_pending_writes(message_id: str, force: bool = False) -> Optional[Tuple[DBMessage, str]]:
    """
    Flush pending writes for a message_id. Returns (db_message, accumulated_text) if flushed.
    """
    if message_id not in PENDING_WRITES or not PENDING_WRITES[message_id]:
        return None
    
    now = time.time()
    last_flush = LAST_FLUSH.get(message_id, 0)
    
    # Only flush if forced (final chunk) or enough time has passed
    if not force and (now - last_flush) < FLUSH_INTERVAL:
        return None
    
    # Get the message details from in-memory store
    msg = None
    room_id = None
    for rid, room in ROOMS.items():
        if message_id in room.messages:
            msg = room.messages[message_id]
            room_id = rid
            break
    
    if not msg or not room_id:
        return None
    
    # Concatenate all pending chunks
    pending_text = "".join(PENDING_WRITES[message_id])
    PENDING_WRITES[message_id].clear()
    LAST_FLUSH[message_id] = now
    
    # Persist to DB
    import asyncio
    def _persist_once() -> Tuple[DBMessage, str]:
        db = next(get_session())
        try:
            _ensure_chat_exists(db, room_id)
            return _upsert_db_message(
                db,
                chat_id=room_id, role=msg.role, msg_id=message_id,
                text=pending_text, is_final=force, persona_id=msg.persona_id
            )
        except Exception:
            # Make sure the aborted txn is rolled back before returning the conn to the pool
            try: db.rollback()
            except Exception: pass
            raise
        finally:
            try: db.close()
            except Exception: pass

    return await asyncio.to_thread(_persist_once)

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
    2) Persist to DB Messages table (accumulated text, completed flag) - batched
    3) Emit training DOM-friendly events via Socket.IO
    """
    room = get_room(room_id)
    mid = message_id or gen_id(None)  # first chunk gets a UUID, later chunks reuse the same message_id
    msg = room.messages.get(mid)
    created_ms_now = int(time.time()*1000)

    if msg is None:
        msg = Message(id=mid, source_id=source_id, role=role, created_ms=created_ms_now, persona_id=persona_id)
        room.messages[mid] = msg
        logger.debug(f"Created new message: mid={mid}, role={role}, chunk_idx={chunk_idx}")
    else:
        # Update persona_id if provided and not set yet
        if persona_id and not msg.persona_id:
            msg.persona_id = persona_id
        logger.debug(f"Reusing message: mid={mid}, role={role}, chunk_idx={chunk_idx}, is_final={is_final}")

    # append in-memory chunk
    msg.chunks.append(TextChunk(
        message_id=mid, chunk_idx=chunk_idx, text=text,
        is_final=is_final, ts_ms=created_ms_now
    ))

    # Add to pending writes for batched DB persistence
    PENDING_WRITES[mid].append(text or "")

    # Emit events your frontend already expects
    if _emit:
        if role == "user":
            # First chunk -> create DB row quickly for UX
            if chunk_idx == 0:
                import asyncio
                def _persist_user() -> Tuple[DBMessage, str]:
                    db = next(get_session())
                    try:
                        _ensure_chat_exists(db, room_id)
                        return _upsert_db_message(
                            db,
                            chat_id=room_id, role=role, msg_id=mid,
                            text=text, is_final=is_final, persona_id=persona_id
                        )
                    except Exception:
                        try: db.rollback()
                        except Exception: pass
                        raise
                    finally:
                        try: db.close()
                        except Exception: pass

                db_msg, acc = await asyncio.to_thread(_persist_user)
                # We already persisted the first chunk; drop it from the pending buffer
                if PENDING_WRITES.get(mid):
                    try:
                        PENDING_WRITES[mid].pop(0)
                    except Exception:
                        PENDING_WRITES[mid].clear()

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

            # Stream per-chunk tokens for transcript (including chunk 0 if non-empty)
            if not is_final:
                acc = "".join(chunk.text for chunk in msg.chunks)
                await _emit(room_id, "user_message_token", {
                    "chat_id": room_id,
                    "message_id": mid,
                    "token": text or "",
                    "accumulated_content": acc,
                })
            else:
                # Finalize: flush any remaining text and mark complete
                res = await _flush_pending_writes(mid, force=True)
                if not res:
                    # Nothing pending; still need to mark DB row completed
                    import asyncio
                    def _mark_complete() -> Tuple[DBMessage, str]:
                        db = next(get_session())
                        try:
                            m = db.exec(select(DBMessage).where(DBMessage.id == mid)).one_or_none()
                            if m and not m.completed:
                                m.completed = True
                                db.add(m); db.commit(); db.refresh(m)
                            if m:
                                return m, (m.content or "")
                            else:
                                # Create a dummy message if none exists
                                dummy_msg = DBMessage(
                                    id=UUID(mid),
                                    chat_id=room_id,
                                    role="user",
                                    content="",
                                    completed=True
                                )
                                return dummy_msg, ""
                        except Exception:
                            try: db.rollback()
                            except Exception: pass
                            raise
                        finally:
                            try: db.close()
                            except Exception: pass
                    db_msg, acc = await asyncio.to_thread(_mark_complete)
                else:
                    db_msg, acc = res
                if db_msg:
                    await _emit(room_id, "user_message_complete", {
                        "chat_id": room_id,
                        "message_id": str(db_msg.id),
                        "final_content": acc or "",
                    })
        else:
            # assistant stream
            # Fix: Use chunk_idx == 0 instead of first_chunk for idempotency
            if chunk_idx == 0 and not is_final:
                # Add idempotency guard for multi-worker safety
                key = f"{room_id}:{mid}"
                if key not in STARTED:
                    STARTED.add(key)
                    await _emit(room_id, "training_message_start", {
                        "chat_id": room_id,
                        "message_id": mid,
                        "persona_id": persona_id,
                    })

            if not is_final:
                # Only emit token events when there is actual token text.
                # This suppresses empty placeholder emissions used to create the message bubble
                # (especially when word-level transcripts drive the UI).
                if text:
                    acc = "".join(chunk.text for chunk in msg.chunks)
                    await _emit(room_id, "training_message_token", {
                        "chat_id": room_id,
                        "message_id": mid,
                        "token": text,
                        "accumulated_content": acc,
                    })
            else:
                # Final chunk - flush all pending writes and emit complete
                result = await _flush_pending_writes(mid, force=True)
                
                if result:
                    db_msg, acc = result
                    await _emit(room_id, "training_message_complete", {
                        "chat_id": room_id,
                        "message_id": str(db_msg.id),
                        "final_content": acc,
                    })

                    # Schedule hint generation for this message
                    import asyncio
                    async def _schedule_hints() -> None:
                        try:
                            def _sync(msg_uuid: uuid.UUID) -> Dict[str, Any]:
                                import asyncio as _asyncio
                                return _asyncio.run(run_hint_agent(msg_uuid))
                            result = await asyncio.to_thread(_sync, uuid.UUID(str(db_msg.id)))
                            await _emit(room_id, "hints_generated", {
                                "chat_id": room_id,
                                "message_id": str(db_msg.id),
                                "success": result.get("success", False),
                                "hints": result.get("hints", []),
                                "message": result.get("message", ""),
                            })
                        except Exception as e:
                            logger.error(f"Failed to generate hints: {e}")
                    asyncio.create_task(_schedule_hints())

    return msg



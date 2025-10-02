# server/app/agents/openai.py
from __future__ import annotations

import asyncio
import base64
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any, Awaitable, Union

import numpy as np
from agents import RunContextWrapper
# ---- OpenAI Agents SDK (pip install openai-agents or openai-agents-python) ----
from agents.realtime import RealtimeAgent as OARealtimeAgent
from agents.realtime import RealtimeRunner, RealtimeSession
from agents.realtime.config import (RealtimeRunConfig,
                                    RealtimeSessionModelSettings)
from agents.realtime.events import RealtimeAgentEndEvent as OAEventAgentEnd
from agents.realtime.events import RealtimeAgentStartEvent as OAEventAgentStart
from agents.realtime.events import RealtimeAudio as OAEventAudio
from agents.realtime.events import RealtimeAudioEnd as OAEventAudioEnd
from agents.realtime.events import \
    RealtimeAudioInterrupted as OAEventAudioInterrupted
from agents.realtime.events import RealtimeError as OAEventError
from agents.realtime.events import RealtimeRawModelEvent as OAEventRaw
from agents.realtime.model_events import \
    RealtimeModelRawServerEvent as OAEventRawServer
from agents.util._types import MaybeAwaitable
from app.bus import PCM_SR, SAMPLES_PER_CHUNK, AudioChunk
from app.db import get_session
from app.models import Chats, Documents, Messages, Personas, Scenarios
from app.services.agents.voice.base import Agent
from app.store import list_messages
from app.utils.chat import get_formatted_conversation_history_with_personas
from sqlalchemy.util import ellipses_string
from sqlmodel import select

logger = logging.getLogger(__name__)


@dataclass
class RealtimeContext:
    session: Any  # SQLAlchemy session
    chat_id: uuid.UUID
    scenario_id: uuid.UUID
    last_user_id: uuid.UUID | None = None


# ---------- audio helpers ----------


def _f32_to_s16le_bytes(x: np.ndarray) -> bytes:
    y = np.clip(x, -1.0, 1.0)
    return (y * 32767.0).astype(np.int16).tobytes()


def _s16le_bytes_to_f32(data: bytes) -> np.ndarray:
    return (np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0).clip(
        -1.0, 1.0
    )


def _resample_linear(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out or x.size == 0:
        return x
    ratio = sr_out / float(sr_in)
    n_out = int(round(x.size * ratio))
    if n_out <= 1:
        return np.zeros(0, dtype=np.float32)
    idx = np.linspace(0, x.size - 1, num=n_out, dtype=np.float32)
    xi = np.arange(x.size, dtype=np.float32)
    return np.interp(idx, xi, x).astype(np.float32)


# ---------- Realtime OpenAI bridge agent (NO local VAD) ----------


class OpenAIAgent(Agent):
    """
    Bridges the room's audio/text to an OpenAI Realtime agent via the OpenAI
    Agents SDK. We do **zero** local VAD — we just stream 20ms PCM frames and
    let the model's server/semantic VAD decide turns, interruptions, and when
    to speak.

    Input:
      - Room mix (excludes ourselves; we also ignore the Beep agent).
      - User chat messages typed in the UI.

    Output:
      - Model audio is published to the room bus as 48kHz mono.
      - Assistant text is streamed into the chat.

    Env (optional):
      OPENAI_REALTIME_MODEL   (default: "gpt-4o-realtime-preview")
      OPENAI_REALTIME_VOICE   (default: none / model default)
      OPENAI_TURN_DETECTION   (default: "semantic_vad", options: "semantic_vad","server_vad")
      OPENAI_TURN_EAGERNESS   (default: "auto")  # "low"|"medium"|"high"|"auto"
      OPENAI_INPUT_SR         (default: 48000)   # we send pcm16 at this SR
      OPENAI_OUTPUT_SR        (default: 24000)   # expected model TTS SR if event lacks it
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        self.model_name = "gpt-4o-mini-realtime-preview"
        self.voice_name = "alloy"
        
        # Hold reference to the RealtimeContext for updates
        self._rtctx: RealtimeContext | None = None

        td_type = "semantic_vad"
        self.turn_detection = {
            "type": td_type,
            # Let the server decide when to answer & allow barge-in
            "create_response": True,
            "interrupt_response": True,
            # give sane defaults; the server may ignore extras it doesn't use
            "eagerness": "auto",
        }

        # Audio formats the model expects/emits (pcm16 everywhere)
        self.input_sr = int(
            os.getenv("OPENAI_INPUT_SR", "24000")
        )  # set to 48000 to skip resample
        self.output_sr = 24000  # ← back to 24k (fixes chipmunk/high pitch)
        self._logged_audio_format = False  # optional: one-time debug print

        self._session: RealtimeSession | None = None
        self._tasks: list[asyncio.Task] = []
        self._running = True
        self._seen_user_msg_ids: set[str] = set()

        # For streaming assistant deltas from OAEventRaw
        # response_id -> {msg_id, chunk_idx, buffer, has_received_audio}
        self._resp_streams: dict[str, dict[str, Any]] = {}
        # Single active user anchor (one bubble max)
        self._user_anchor: dict[str, Any] = {
            "msg_id": None,
            "chunk_idx": 0,
            "had_text": False,
            "open": False,
            "parent_id": None,
        }
        self._anchor_item_ids: set[str] = (
            set()
        )  # all item_ids contributing to this anchor
        self._latest_item_id: str | None = None  # last speech_started item_id

        # --- TTS hard mute + draining task ---
        self._tts_blocked: bool = False
        self._tts_drain_task: asyncio.Task | None = None
        self._audio_buf = np.zeros(0, dtype=np.float32)  # shared TTS buffer

        # --- Pending user messages queue for barge-in ---
        self._pending_user_msgs: list[str] = []

        # --- Persona ID for assistant messages ---
        self._assistant_persona_id: str | None = None

        # Track the most recent response id to associate first audio chunks
        self._current_response_id: str | None = None

        # --- CTC alignment accumulators ---
        self._resp_audio: dict[str, np.ndarray] = {}
        self._resp_text: dict[str, list[str]] = {}
        self._resp_audio_start_ts_ms: dict[str, int] = {}
        self._rid_to_msg: dict[str, str] = {}
        self._processed_done: set[str] = set()
        # Track model audio chunking to drive partial CTC timing
        self._resp_audio_chunk_count: dict[str, int] = {}

        # --- Uplink queue for decoupling audio capture from network I/O ---
        # Increased from 256 to 512 to reduce audio drops under load
        self._uplink_q: asyncio.Queue[bytes] = asyncio.Queue(maxsize=512)
        self._uplink_task: asyncio.Task | None = None
        self._uplink_drops: int = 0  # Track dropped frames for monitoring

        # --- Instruction caching (keyed by chat_id + last_user_id for branching) ---
        self._cached_instructions: str | None = None
        self._instructions_cache_key: tuple[str, str | None] | None = None

        # --- HTTP client pooling for CTC alignment calls ---
        self._http_client: Any = None  # httpx.AsyncClient, lazily initialized

        async def _audio_gate(chunk: AudioChunk) -> AudioChunk:
            # If blocked, turn any frame we publish into silence instantly.
            if self._tts_blocked:
                chunk.data[:] = 0.0
            return chunk

        self.audio_hook = _audio_gate

    def _block_tts(self) -> None:
        # Instant stop: mute, drop buffer, cancel drainer.
        self._tts_blocked = True
        self._audio_buf = np.zeros(0, dtype=np.float32)
        if self._tts_drain_task and not self._tts_drain_task.done():
            self._tts_drain_task.cancel()
        self._tts_drain_task = None

    def _ensure_unblocked_and_draining(self) -> None:
        if self._tts_blocked:
            # Stay blocked until a new response begins; caller decides when to unblock.
            return
        if self._tts_drain_task is None or self._tts_drain_task.done():
            self._tts_drain_task = asyncio.create_task(self._drain_tts())

    async def _mark_interruption_for_active_response(self) -> None:
        """Emit transcript_stop for the in-flight assistant message and persist interruption_ms.
        Only works with existing messages - never creates placeholders.
        """
        try:
            # Identify the current response id
            rid = self._current_response_id
            if not rid:
                if len(self._resp_streams) == 1:
                    try:
                        rid = next(iter(self._resp_streams.keys()))
                    except Exception:
                        rid = None
            if not rid:
                return

            # Resolve message id for this response
            msg_id: str | None = None
            st = self._resp_streams.get(rid)
            if st is not None and st.get("msg_id") is not None:
                try:
                    msg_id = str(st.get("msg_id"))  # type: ignore[arg-type]
                except Exception:
                    msg_id = None
            if not msg_id:
                msg_id = self._rid_to_msg.get(rid)
            
            # If we don't already have a concrete assistant message id, there is
            # nothing to "stop" – do NOT create placeholders here.
            if not msg_id:
                return

            now_ms = int(time.time() * 1000)

            # Notify clients to clamp progressive transcript rendering
            try:
                await self.room.broadcast_transcript_stop(
                    agent_id=self.id,
                    message_id=msg_id,
                    stop_ts_ms=now_ms,
                )
            except Exception:
                pass

            # Persist interruption timestamp only if the row already exists AND has content
            try:
                from sqlalchemy import text as _text

                db_session = next(get_session())
                try:
                    conn = db_session.connection()
                    # Only set interruption against real, non-empty messages
                    row = conn.execute(
                        _text("SELECT created_at, content FROM messages WHERE id = :id"),
                        {"id": str(msg_id)},
                    ).fetchone()
                    if not row or not (row[1] or "").strip():
                        return
                    created_at = row[0]
                    # Compute relative ms from created_at so it fits int4
                    rel_ms = 0
                    try:
                        import datetime as _dt

                        if isinstance(created_at, _dt.datetime):
                            if created_at.tzinfo is None:
                                created_at = created_at.replace(tzinfo=_dt.UTC)
                            created_ms = int(created_at.timestamp() * 1000)
                            rel = int(now_ms) - created_ms
                            rel_ms = max(0, min(rel, 2_147_483_647))
                    except Exception:
                        rel_ms = 0
                    conn.execute(
                        _text(
                            "UPDATE messages SET interruption_ms = :ts WHERE id = :id"
                        ),
                        {"ts": int(rel_ms), "id": str(msg_id)},
                    )
                    db_session.commit()
                finally:
                    try:
                        db_session.close()
                    except Exception:
                        pass
            except Exception:
                pass
        except Exception:
            pass

    async def _delete_message_if_empty(self, msg_id: str) -> None:
        """Delete a message if it has no content (pure placeholder)."""
        try:
            from sqlalchemy import text as _text
            db = next(get_session())
            try:
                conn = db.connection()
                conn.execute(_text("""
                    DELETE FROM messages
                    WHERE id = :id
                      AND (content IS NULL OR content = '')
                """), {"id": str(msg_id)})
                db.commit()
            finally:
                db.close()
        except Exception:
            pass

    async def _get_assistant_persona_id(self) -> str | None:
        """Get assistant persona from chat.persona_ids; specifically look for agent personas (profile_id is null)."""
        if self._assistant_persona_id is not None:
            return self._assistant_persona_id

        try:
            from app.db import get_session
            from app.models import Chats, Personas
            from sqlmodel import select

            db_session = next(get_session())
            try:
                # Get the chat
                result = db_session.exec(select(Chats).where(Chats.id == self.room.id))
                chat = result.one_or_none()
                if not chat:
                    return None

                # Get chat.persona_ids (array) and find the first agent persona
                persona_id = None
                try:
                    from sqlalchemy import text as _text

                    conn = db_session.connection()
                    row = conn.execute(
                        _text("SELECT persona_ids FROM chats WHERE id = :id"),
                        {"id": str(chat.id)},
                    ).fetchone()
                    pid_list = list(row[0]) if row and row[0] else []

                    # Look for the first agent persona (profile_id is null)
                    for pid in pid_list:
                        persona = db_session.exec(
                            select(Personas).where(Personas.id == pid)
                        ).one_or_none()
                        if persona and persona.profile_id is None:
                            # This is an agent persona
                            persona_id = str(pid)
                            logger.info(
                                f"Found agent persona: {persona.name} (ID: {pid})"
                            )
                            break

                    if not persona_id and pid_list:
                        logger.warning(
                            f"No agent persona found in chat {chat.id}. Available personas: {pid_list}"
                        )

                except Exception as e:
                    logger.error(
                        f"Error processing persona_ids for chat {chat.id}: {str(e)}"
                    )
                    pass

                if persona_id:
                    self._assistant_persona_id = str(persona_id)
                    return self._assistant_persona_id

            finally:
                db_session.close()
        except Exception as e:
            logger.error(f"Error getting assistant persona ID: {str(e)}")

        return None

    async def _get_user_persona_id(self) -> str | None:
        """Get the user persona ID from the room's user profile."""
        # cached?
        if getattr(self.room, "user_persona_id", None):
            return self.room.user_persona_id

        try:
            from app.db import get_session
            from app.models import Personas
            from sqlmodel import select

            profile_id = getattr(self.room, "user_profile_id", None)
            if not profile_id:
                return None

            db_session = next(get_session())
            try:
                prof = db_session.exec(
                    select(Personas).where(Personas.profile_id == profile_id)
                ).one_or_none()
                if prof:
                    self.room.user_persona_id = str(prof.id)
                    return self.room.user_persona_id
            finally:
                db_session.close()
        except Exception as e:
            logger.error(f"Error getting user persona ID: {e}")

        return None

    def _update_ctx_last_user(self, mid: str | None) -> None:
        """Update the last_user_id in the RealtimeContext."""
        try:
            if self._rtctx is not None:
                self._rtctx.last_user_id = uuid.UUID(str(mid)) if mid else None
                # Invalidate instruction cache when last_user_id changes
                self._invalidate_instruction_cache()
        except Exception:
            pass

    def _invalidate_instruction_cache(self) -> None:
        """Invalidate cached instructions to force regeneration on next turn."""
        if self._cached_instructions is not None:
            logger.debug(f"[instructions] Cache invalidated (was key={self._instructions_cache_key})")
        self._cached_instructions = None
        self._instructions_cache_key = None

    def _resolve_parent_id(self, st: dict[str, Any] | None = None) -> str | None:
        """
        Resolve parent_id with proper fallback priority.
        If st has parent_id already set, use it (snapshots at response.created).
        Otherwise compute from current room state.
        """
        if st and st.get("parent_id") is not None:
            return str(st["parent_id"])
        
        # Prefer open user anchor if present, otherwise last assistant
        if self._user_anchor["open"] and self._user_anchor["msg_id"]:
            return str(self._user_anchor["msg_id"])
        
        return self.room.last_user_id

    async def _drain_tts(self) -> None:
        try:
            while self._running and not self._tts_blocked:
                if len(self._audio_buf) < SAMPLES_PER_CHUNK:
                    await asyncio.sleep(0.002)
                    continue
                frame = self._audio_buf[:SAMPLES_PER_CHUNK]
                self._audio_buf = self._audio_buf[SAMPLES_PER_CHUNK:]
                # publish_audio passes through our audio_hook, so mute is instant if flipped
                await self.publish_audio((frame * 0.8).astype(np.float32))
                await asyncio.sleep(SAMPLES_PER_CHUNK / PCM_SR)  # 20ms pacing
        except asyncio.CancelledError:
            pass

    async def _uplink_writer(self, session: RealtimeSession) -> None:
        try:
            while self._running:
                b = await self._uplink_q.get()
                try:
                    await session.send_audio(b, commit=False)
                finally:
                    self._uplink_q.task_done()
        except asyncio.CancelledError:
            pass

    async def _get_http_client(self) -> Any:
        """Get or create pooled HTTP client for CTC alignment calls."""
        if self._http_client is None:
            import httpx  # type: ignore
            self._http_client = httpx.AsyncClient(timeout=10.0)
        return self._http_client

    async def _align_ctc(
        self,
        *,
        audio_f32: np.ndarray,
        sr: int,
        reference_text: str,
        stage: str = "final",
        num_chunks: int | None = None,
        chunk_ms: int = 20,
    ) -> tuple[str, list[dict[str, Any]], np.ndarray | None]:
        """Call external model service /align_ctc; returns (text, words[], audio)."""
        try:
            base = os.getenv("MODEL_SERVICE_URL") or "http://localhost:8001"
            if not base:
                return reference_text, [], None

            b = audio_f32.astype(np.float32).tobytes()
            payload: dict[str, Any] = {
                "audio_b64": base64.b64encode(b).decode("utf-8"),
                "sr": int(sr),
                "reference_text": reference_text or "",
                "stage": stage,
                "chunk_ms": int(chunk_ms),
            }
            if num_chunks is not None:
                payload["num_chunks"] = int(num_chunks)
            url = base.rstrip("/") + "/align_ctc"
            
            # Use pooled client for better performance
            client = await self._get_http_client()
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            text = str(data.get("text") or reference_text or "")
            words_in = data.get("words") or []
            words: list[dict[str, Any]] = []
            if isinstance(words_in, list):
                for w in words_in:
                    try:
                        words.append(
                            {
                                "start_ms": int(w.get("start_ms", 0)),
                                "end_ms": int(w.get("end_ms", 0)),
                                "text": str(w.get("text", "")),
                            }
                        )
                    except Exception:
                        pass
            
            # Extract and decode audio if provided
            returned_audio = None
            audio_b64 = data.get("audio_b64")
            if audio_b64:
                try:
                    audio_bytes = base64.b64decode(audio_b64)
                    returned_audio = np.frombuffer(audio_bytes, dtype=np.float32)
                except Exception:
                    pass
            
            return text, words, returned_audio
        except Exception:
            return reference_text, [], None

    def _wire_user_text_stream(self, session: RealtimeSession) -> None:
        """
        Monkey-patch Room.append_text_chunk so we see user text the moment it arrives.
        We buffer chunks by message_id and send to the model once is_final=True.
        """
        if getattr(self.room, "_openai_text_hooked", False):
            return  # idempotent

        orig = self.room.append_text_chunk
        user_buf: dict[str, list[str]] = {}
        TRANSCRIPT_SOURCE_ID = "openai:user-transcript"
        agent_self = self  # close over 'self'

        async def wrapped(
            *,
            source_id: str,
            role: str,
            text: str,
            message_id: str | None,
            chunk_idx: int,
            is_final: bool,
            persona_id: str | None = None,
            voice: bool = False,
            parent_id: str | None = None,
        ) -> str:
            # If a user anchor is open, route typed text into that message
            use_anchor = (
                role == "user"
                and source_id != TRANSCRIPT_SOURCE_ID
                and agent_self._user_anchor["open"]
                and agent_self._user_anchor["msg_id"] is not None
            )

            if use_anchor:
                message_id = (
                    str(agent_self._user_anchor["msg_id"])
                    if agent_self._user_anchor["msg_id"] is not None
                    else None
                )
                chunk_idx = (
                    int(agent_self._user_anchor["chunk_idx"])
                    if agent_self._user_anchor["chunk_idx"] is not None
                    else 0
                )

            # Get user persona_id if not provided for user messages
            if role == "user" and not persona_id:
                persona_id = await agent_self._get_user_persona_id()

            # Fallback only for typed text. For voice transcript, keep the anchor's parent.
            if role == "user" and parent_id is None:
                if source_id == "openai:user-transcript":
                    parent_id = agent_self._user_anchor.get("parent_id")
                else:
                    parent_id = (agent_self.room.next_user_parent_id
                                 or agent_self.room.last_assistant_id)
                logger.debug(f"[user:append] parent_id={parent_id} override={agent_self.room.next_user_parent_id} last_assist={agent_self.room.last_assistant_id}")

            mid = await orig(
                source_id=source_id,
                role=role,
                text=text,
                message_id=message_id,
                chunk_idx=chunk_idx,
                is_final=is_final,
                persona_id=persona_id,
                voice=voice,
                parent_id=parent_id,
            )

            # On user finalization: update pointers and consume override
            if role == "user" and is_final:
                try:
                    agent_self.room.set_last_user(mid)
                    agent_self.room.set_next_user_parent(None)
                except Exception:
                    pass

            # 1) Local barge-in for ANY typed user chunk (not transcript)
            if role == "user" and source_id != TRANSCRIPT_SOURCE_ID:
                agent_self._block_tts()
                # Mark interruption immediately so the UI clamps transcript rendering
                try:
                    await agent_self._mark_interruption_for_active_response()
                except Exception:
                    pass

            # 2) Buffer typed text, then either send immediately or queue for after current response
            if role == "user" and source_id != TRANSCRIPT_SOURCE_ID:
                buf = user_buf.setdefault(mid, [])
                if text:
                    buf.append(text)
                if is_final:
                    full = "".join(buf).strip()
                    user_buf.pop(mid, None)
                    if full:
                        if agent_self._resp_streams:
                            # Assistant is mid-response → queue for after it finishes
                            agent_self._pending_user_msgs.append(full)
                        else:
                            # No active response → send now
                            try:
                                await session.send_message(full)
                            except Exception:
                                pass  # keep local UX

            # If we wrote into the anchor, advance it
            if use_anchor:
                if text:
                    agent_self._user_anchor["had_text"] = True
                agent_self._user_anchor["chunk_idx"] = (
                    agent_self._user_anchor["chunk_idx"] or 0
                ) + 1

            return mid

        # Patch the instance method (doesn't interfere with socket broadcasting)
        setattr(self.room, 'append_text_chunk', wrapped)
        setattr(self.room, '_openai_text_hooked', True)

    # ---- session wiring -----------------------------------------------------

    async def _start_session(self) -> RealtimeSession:
        chat_id = self.room.id
        print(f"[OPENAI] Starting session for chat_id: {chat_id}")

        persona_id = await self._get_assistant_persona_id()
        print(f"[OPENAI] Resolved assistant persona_id: {persona_id}")

        db_session = next(get_session())

        chat: Chats | None = db_session.exec(
            select(Chats).where(Chats.id == chat_id)
        ).one_or_none()

        if not chat:
            logger.error(f"Chat lookup failed for ID: {chat_id}")
            raise ValueError(f"Chat with ID {chat_id} not found")

        persona: Personas | None = db_session.exec(
            select(Personas).where(Personas.id == persona_id)
        ).one_or_none()

        if not persona:
            logger.error(f"Persona lookup failed for ID: {persona_id}")
            raise ValueError(f"Persona with ID {persona_id} not found")

        print(
            f"[OPENAI] Found persona: Name='{persona.name}', Voice='{persona.voice}', ProfileID='{persona.profile_id}'"
        )
        logger.info(f"Found persona: Name='{persona.name}', Voice='{persona.voice}'")

        # Get the scenario for the preamble
        if not chat.scenario_id:
            raise ValueError(f"Chat {chat_id} has no scenario_id")

        realtime_voice = persona.voice
        valid_voices = [
            "alloy",
            "ash",
            "ballad",
            "coral",
            "echo",
            "sage",
            "shimmer",
            "verse",
        ]
        if realtime_voice not in valid_voices:
            realtime_voice = "alloy"

        # Example function for dynamic instructions
        def create_dynamic_instructions(ctx: RunContextWrapper, agent: OARealtimeAgent) -> MaybeAwaitable[str]:
            """
            Example function that generates instructions dynamically.
            Cached by (chat_id, last_user_id) to support conversation branching.
            Signature matches: Callable[[RunContextWrapper[TContext], RealtimeAgent[TContext]], MaybeAwaitable[str]]
            """
            # Access context data from the RealtimeContext
            context = ctx.context  # This is our RealtimeContext instance
            session = context.session
            chat_id = context.chat_id
            scenario_id = context.scenario_id
            last_user_id = context.last_user_id
            
            # Check cache: key = (chat_id, last_user_id) to preserve branching
            cache_key = (str(chat_id), str(last_user_id) if last_user_id else None)
            if self._instructions_cache_key == cache_key and self._cached_instructions:
                logger.debug(f"[instructions] Cache HIT for chat={chat_id}, last_user={last_user_id}")
                return self._cached_instructions
            
            logger.debug(f"[instructions] Cache MISS for chat={chat_id}, last_user={last_user_id}")
            
            # Get core entities (keeping simple for SQLModel compatibility)
            chat = session.exec(
                select(Chats).where(Chats.id == chat_id)
            ).one_or_none()
            if not chat:
                raise ValueError(f"Chat with ID {chat_id} not found")
            
            persona = session.exec(
                select(Personas).where(Personas.id == persona_id)
            ).one_or_none()
            if not persona:
                raise ValueError(f"Persona with ID {persona_id} not found")
            
            scenario = session.exec(
                select(Scenarios).where(Scenarios.id == scenario_id)
            ).one_or_none()
            if not scenario:
                raise ValueError(
                    f"Scenario {scenario_id} not found for chat {chat_id}"
                )

            # get all messages for the chat
            messages = session.exec(
                select(Messages).where(Messages.chat_id == chat_id)
            ).all()

            # Format conversation history with persona names
            formatted_history = get_formatted_conversation_history_with_personas(
                messages, session, last_user_id=last_user_id
            )

            # Build enhanced instructions: persona prompt + description + documents + history
            instructions_parts = []

            # 1. Get persona-specific prompt from chat.prompts
            chat_prompts = chat.prompts or {}
            persona_prompt = chat_prompts.get(str(persona_id))
            if persona_prompt:
                instructions_parts.append(persona_prompt)

            # 2. Add persona description
            if persona.description:
                instructions_parts.append(persona.description)

            # 3. Add relevant documents from scenario
            if scenario and scenario.document_ids:
                try:
                    logger.info(
                        f"Fetching documents for scenario {scenario.id}, document_ids: {scenario.document_ids}"
                    )
                    # Optimized: Batch fetch documents using OR conditions (simpler than IN with SQLModel)
                    documents = []
                    if len(scenario.document_ids) <= 10:  # Reasonable batch size
                        # Build OR conditions for each doc_id
                        from sqlmodel import or_
                        conditions = [Documents.id == doc_id for doc_id in scenario.document_ids]
                        stmt = select(Documents).where(or_(*conditions))
                        documents = list(session.exec(stmt))
                    else:
                        # Fallback: fetch individually if too many (avoid complex query)
                        for doc_id in scenario.document_ids:
                            doc = session.exec(select(Documents).where(Documents.id == doc_id)).one_or_none()
                            if doc:
                                documents.append(doc)
                    
                    logger.info(f"Found {len(documents)} documents (requested {len(scenario.document_ids)})")
                    
                    # Log any missing documents
                    found_ids = {doc.id for doc in documents}
                    missing_ids = set(scenario.document_ids) - found_ids
                    if missing_ids:
                        logger.warning(f"Documents not found: {missing_ids}")

                    if documents:
                        doc_info = []
                        doc_info.append(
                            "These are the relevant documents for this scenario:"
                        )
                        for doc in documents:
                            if doc.title and doc.content:
                                doc_info.append(f"Document: {doc.title}")
                                doc_info.append(f"Content: {doc.content}")
                                doc_info.append("")  # Empty line for separation

                        if doc_info:
                            instructions_parts.append("\n".join(doc_info))
                            logger.info(f"Added {len(documents)} documents to instructions")
                    else:
                        logger.info("No documents found or documents have no title/content")
                except Exception as e:
                    logger.warning(
                        f"Failed to fetch documents for scenario {scenario.id}: {e}"
                    )
            else:
                logger.info(
                    f"No scenario or document_ids found. Scenario: {scenario is not None}, document_ids: {scenario.document_ids if scenario else None}"
                )

            # 4. Add formatted conversation history if available
            if formatted_history:
                instructions_parts.append(f"Conversation history:\n{formatted_history}")

            # Join all parts with double newlines for clarity
            realtime_instructions = (
                "\n\n".join(instructions_parts)
                if instructions_parts
                else "Be helpful and respond to the user's messages."
            )
            
            # Cache the result with (chat_id, last_user_id) key
            self._cached_instructions = realtime_instructions
            self._instructions_cache_key = cache_key
            logger.debug(f"[instructions] Cached for key={cache_key}, length={len(realtime_instructions)}")
            
            return realtime_instructions

        oa_agent = OARealtimeAgent[RealtimeContext](
            name="OpenAI Realtime",
            instructions=create_dynamic_instructions,
        )

        model_settings: RealtimeSessionModelSettings = {
            "model_name": "gpt-realtime",
            "modalities": ["text"],
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "turn_detection": {
                "type": "semantic_vad",
                "create_response": True,
                "interrupt_response": True,
                "eagerness": "auto",
            },
            "voice": realtime_voice,
            "input_audio_transcription": {"model": "gpt-4o-mini-transcribe"},
        }

        run_cfg = RealtimeRunConfig(model_settings=model_settings)

        runner = RealtimeRunner(oa_agent, config=run_cfg)
        
        # Create RealtimeContext with database session and IDs
        self._rtctx = RealtimeContext(
            session=db_session,
            chat_id=chat.id,
            scenario_id=chat.scenario_id,
            last_user_id=uuid.UUID(self.room.last_user_id) if self.room.last_user_id else None
        )
        
        session: RealtimeSession = await runner.run(context=self._rtctx)
        session = await session.enter()  # ✅ correct way to enter
        logger.debug("[openai] realtime session started")
        return session

    # ---- pumps --------------------------------------------------------------

    async def _pump_audio_in(self, session: RealtimeSession) -> None:
        """
        Always send 20ms frames at self.input_sr. If no mic frame arrives before
        the deadline, send a zero (silence) frame. We do NOT call commit().
        """

        # Keep the model from hearing the beep agent only (do NOT ignore ourselves here).
        try:
            self.bus.set_ignore(self.id, {"agent:beep"})
        except Exception:
            pass

        # Frame timing @ 20ms at the DECLARED input SR (you set self.input_sr = 24000)
        FRAME_SEC = 0.020
        OUT_SAMPLES_PER_FRAME = int(round(self.input_sr * FRAME_SEC))  # 24k -> 480
        SILENCE_F32 = np.zeros(OUT_SAMPLES_PER_FRAME, dtype=np.float32)
        SILENCE_BYTES = _f32_to_s16le_bytes(SILENCE_F32)

        n = 0
        t0 = time.time()
        next_deadline = time.perf_counter()

        try:
            while self._running:
                # target time for this frame
                next_deadline += FRAME_SEC

                # Try to get one bus chunk in time; otherwise send silence
                b = None
                remaining = next_deadline - time.perf_counter()
                timeout = max(0.0, min(remaining, FRAME_SEC))
                try:
                    # A) wait for bus
                    t_a0 = time.perf_counter()
                    chunk = await asyncio.wait_for(self.sub.recv(), timeout=timeout)
                    t_a1 = time.perf_counter()

                    x = chunk.data  # float32 mono @ PCM_SR (48k)

                    if x is None or x.size == 0:
                        # nothing from bus → silence frame
                        b = SILENCE_BYTES
                    else:
                        # B) process (resample, preamp, pack)
                        t_b0 = time.perf_counter()

                        # resample 48k → self.input_sr (24k) if needed with proper anti-aliasing
                        if self.input_sr != PCM_SR:  # 24000 vs 48000
                            x = _resample_linear(x, PCM_SR, self.input_sr)

                        # # optional: small preamp so VAD/ASR have healthy levels
                        # pre_db = float(os.getenv("OPENAI_INPUT_PREAMP_DB", "18"))
                        # if pre_db != 0.0:
                        #     x = np.clip(x * (10.0 ** (pre_db / 20.0)), -1.0, 1.0).astype(np.float32)

                        # ensure exact 20ms frame size at self.input_sr
                        if x.size < OUT_SAMPLES_PER_FRAME:
                            x = np.pad(x, (0, OUT_SAMPLES_PER_FRAME - x.size))
                        elif x.size > OUT_SAMPLES_PER_FRAME:
                            x = x[:OUT_SAMPLES_PER_FRAME]

                        b = _f32_to_s16le_bytes(x)
                        t_b1 = time.perf_counter()

                        # if os.getenv("OPENAI_DEBUG", "0") == "1" and n % 100 == 0:
                        #     rms = float(np.sqrt(np.mean(x * x)) + 1e-12)
                        #     print(f"[openai][mic-dump] len_f32={x.size} len_bytes={len(b)} rms_post={rms:.6f} preamp_db={pre_db}")

                except TimeoutError:
                    # No bus chunk before the deadline → send silence
                    b = SILENCE_BYTES
                    t_a0 = t_a1 = t_b0 = t_b1 = time.perf_counter()

                # Send upstream via queue (NO commit)
                try:
                    self._uplink_q.put_nowait(b)
                except asyncio.QueueFull:
                    # drop oldest to keep latency tight
                    self._uplink_drops += 1
                    if self._uplink_drops % 50 == 1:
                        logger.warning(f"[openai] uplink queue full, dropped {self._uplink_drops} frames total")
                    try:
                        _ = self._uplink_q.get_nowait()
                        self._uplink_q.task_done()
                    except asyncio.QueueEmpty:
                        pass
                    self._uplink_q.put_nowait(b)

                if n % 50 == 0:
                    logger.debug(
                        f"[pump] recv={(t_a1-t_a0)*1000:.1f}ms proc={(t_b1-t_b0)*1000:.1f}ms send=queue"
                    )

                n += 1
                if n % 100 == 0:
                    dt = time.time() - t0
                    if dt > 0:
                        logger.debug(
                            f"[openai] audio→model {n} frames (~{n*FRAME_SEC:.1f}s) in {dt:.1f}s"
                        )

                # Maintain pacing if we're early
                remaining = next_deadline - time.perf_counter()
                if remaining < -0.02:
                    # we fell behind by >1 frame → reset schedule
                    next_deadline = time.perf_counter()
                elif remaining > 0:
                    await asyncio.sleep(remaining)

        finally:
            pass

    async def _pump_user_text_in(self, session: RealtimeSession) -> None:
        """
        Poll the room store for new user messages and forward to the model.
        We keep it self-contained so you don't have to change room/main code.
        """
        poll_ms = 200
        while self._running:
            try:
                msgs = list_messages(self.room.id)
                for m in msgs:
                    if m.role != "user" or m.id in self._seen_user_msg_ids:
                        continue
                    # stitch text from chunks (take the latest text per chunk_idx)
                    # send only final messages; if not final, you could stream deltas.
                    chunks = sorted(m.chunks, key=lambda c: c.chunk_idx)
                    if not chunks:
                        continue
                    if not any(c.is_final for c in chunks):
                        continue
                    text = "".join(c.text for c in chunks)
                    if text.strip():
                        await session.send_message(text.strip())
                    self._seen_user_msg_ids.add(m.id)
            except Exception:
                pass
            await asyncio.sleep(poll_ms / 1000.0)

    # ---- Event handlers for model output pump --------------------------------

    async def _ensure_assistant_message_exists(
        self, st: dict[str, Any], persona_id: str | None
    ) -> str:
        """
        Ensure assistant message exists for streaming. Creates if needed.
        Returns message_id.
        """
        if st.get("msg_id"):
            return str(st["msg_id"])

        parent_now = self._resolve_parent_id(st)
        st["parent_id"] = parent_now
        st["msg_id"] = await self.publish_text_chunk(
            text="",
            message_id=None,
            chunk_idx=0,
            is_final=False,
            persona_id=persona_id,
            voice=True,
            parent_id=parent_now,
        )
        print(f"[assist:msg] mid={st['msg_id']} parent={parent_now}")
        self.room.set_last_assistant(st["msg_id"])
        return str(st["msg_id"])

    async def _handle_audio_event(self, ev: OAEventAudio) -> None:
        """Handle incoming audio from OpenAI model."""
        # Small guard to prevent endless mute
        if self._tts_blocked:
            self._tts_blocked = False
            self._ensure_unblocked_and_draining()

        # Heuristic coupling: on first audio for current response, flush buffered text
        target_rid = None
        rid = getattr(self, "_current_response_id", None)
        if rid and rid in self._resp_streams:
            target_rid = rid
        elif len(self._resp_streams) == 1:
            try:
                target_rid = next(iter(self._resp_streams.keys()))
            except StopIteration:
                target_rid = None

        if target_rid:
            st = self._resp_streams.get(target_rid)
            if st is not None and not st.get("has_received_audio"):
                st["has_received_audio"] = True
                buffered_text = "".join(st.get("buffer", []))
                timestamps_enabled = bool(
                    getattr(self.room, "word_timestamps_enabled", True)
                )
                
                # Only create message if we have buffered text AND timestamps are disabled
                if not timestamps_enabled and buffered_text:
                    persona_id = await self._get_assistant_persona_id()
                    if st.get("msg_id") is None:
                        await self._ensure_assistant_message_exists(st, persona_id)
                    
                    await self.publish_text_chunk(
                        text=buffered_text,
                        message_id=st["msg_id"],
                        chunk_idx=st["chunk_idx"],
                        is_final=False,
                        persona_id=persona_id,
                        voice=True,
                        parent_id=st["parent_id"],
                    )
                    # Now it's safe to thread the next user turn to this real message
                    self.room.set_next_user_parent(st["msg_id"])
                    st["chunk_idx"] += 1
                    # Save flushed text for partial CTC reference
                    st["last_flushed_text"] = buffered_text
                    st["buffer"].clear()

        # Extract audio bytes
        audio_bytes = (
            getattr(ev.audio, "audio", None)
            or getattr(ev.audio, "data", None)
            or getattr(ev.audio, "bytes", None)
        )
        if audio_bytes is None:
            return
        if isinstance(audio_bytes, str):
            try:
                audio_bytes = base64.b64decode(audio_bytes)
            except Exception:
                return
        if not isinstance(audio_bytes, (bytes, bytearray)):
            return

        f32 = _s16le_bytes_to_f32(audio_bytes)

        # Optional: log once
        if not self._logged_audio_format:
            logger.debug(
                f"[openai] model audio: sr={self.output_sr}Hz, bytes={len(audio_bytes)}"
            )
            self._logged_audio_format = True

        # Resample to the bus rate (48k) if needed
        if self.output_sr != PCM_SR:
            f32 = _resample_linear(f32, self.output_sr, PCM_SR)

        # Append to shared buffer and (re)start the drainer if not blocked
        self._audio_buf = np.concatenate([self._audio_buf, f32])
        self._ensure_unblocked_and_draining()

        # Accumulate per-response audio for alignment
        rid_for_audio = getattr(self, "_current_response_id", None) or "_default"
        
        # Count model-emitted audio chunks
        try:
            self._resp_audio_chunk_count[rid_for_audio] = 1 + int(
                self._resp_audio_chunk_count.get(rid_for_audio, 0)
            )
        except Exception:
            pass

        prev_audio = self._resp_audio.get(rid_for_audio)
        self._resp_audio[rid_for_audio] = (
            np.concatenate([prev_audio, f32])
            if isinstance(prev_audio, np.ndarray)
            else np.copy(f32)
        )
        if rid_for_audio not in self._resp_audio_start_ts_ms:
            self._resp_audio_start_ts_ms[rid_for_audio] = int(time.time() * 1000)

        # After first audio arrives, run PARTIAL CTC exactly once for this response
        await self._try_partial_ctc(target_rid)

    async def _try_partial_ctc(self, target_rid: str | None) -> None:
        """Run partial CTC alignment if conditions are met."""
        try:
            if not target_rid or target_rid not in self._resp_streams:
                return

            st2 = self._resp_streams.get(target_rid) or {}
            # Run partial when we've received enough audio OR text chunks
            audio_chunks_target = int(os.getenv("CTC_PARTIAL_AUDIO_CHUNKS", "6"))
            text_chunks_target = int(os.getenv("CTC_PARTIAL_TEXT_CHUNKS", "2"))
            
            # Count text chunks for text-based triggering
            text_chunk_count = len(st2.get("buffer", []))
            audio_chunk_count = int(self._resp_audio_chunk_count.get(target_rid, 0))

            # Trigger partial CTC when EITHER condition is met
            audio_trigger = (
                st2.get("has_received_audio")
                and audio_chunk_count == audio_chunks_target
            )

            text_trigger = (
                text_chunk_count >= text_chunks_target
                and "".join(st2.get("buffer", [])).strip()  # Has actual text content
            )

            if (
                not st2.get("partial_ctc_done", False)
                and (audio_chunks_target > 0 or text_chunks_target > 0)
                and (audio_trigger or text_trigger)
            ):
                buffered_text_now = "".join(st2.get("buffer", []))
                # Combine pre-audio (flushed) + post-audio (buffer) for best reference
                reference_text = (st2.get("last_flushed_text") or "") + buffered_text_now
                
                # Map response->message for clients
                if st2.get("msg_id"):
                    self._rid_to_msg[target_rid] = str(st2["msg_id"])
                
                audio_arr = self._resp_audio.get(target_rid, np.zeros(0, dtype=np.float32))
                start_ts = self._resp_audio_start_ts_ms.get(target_rid, int(time.time() * 1000))
                
                if audio_arr is not None:
                    logger.info(
                        f"[ctc][partial] rid={target_rid} samples={audio_arr.size} audio_chunks={audio_chunk_count}/{audio_chunks_target} text_chunks={text_chunk_count}/{text_chunks_target} text_len={len(reference_text)}"
                    )
                    _, words_p, _ = await self._align_ctc(
                        audio_f32=audio_arr,
                        sr=PCM_SR,
                        reference_text=reference_text,
                        stage="partial",
                    )
                    logger.debug(f"[ctc][partial] words={len(words_p)}")
                    if words_p:
                        # Ensure message exists before broadcasting transcript
                        if st2.get("msg_id") is None:
                            persona_id = await self._get_assistant_persona_id()
                            await self._ensure_assistant_message_exists(st2, persona_id)
                        
                        await self.room.broadcast_transcript(
                            agent_id=self.id,
                            message_id=str(st2["msg_id"]),
                            start_ts_ms=start_ts,
                            words=words_p,
                            full_text=reference_text,
                        )
                st2["partial_ctc_done"] = True
        except Exception:
            pass

    async def _handle_text_delta(
        self, session: RealtimeSession, payload: dict[str, Any], evt_type: str
    ) -> None:
        """Handle streaming text deltas from the model."""
        rid = (
            payload.get("response_id")
            or (payload.get("response") or {}).get("id")
            or "_default"
        )

        # Extract delta text
        delta = payload.get("delta", "") or ""
        if not delta:
            # Try alternate locations
            ot = payload.get("output_text")
            if isinstance(ot, dict):
                delta = ot.get("delta", "") or ""

        if not delta:
            return

        st = self._resp_streams.setdefault(
            rid,
            {
                "msg_id": None,
                "chunk_idx": 0,
                "buffer": [],
                "has_received_audio": False,
                "partial_ctc_done": False,
            },
        )

        # Always accumulate a full-text copy for robust finalization
        self._resp_text.setdefault(rid, []).append(delta)

        timestamps_enabled = bool(getattr(self.room, "word_timestamps_enabled", True))

        if timestamps_enabled:
            # Buffer only; final transcript will be emitted after alignment
            st["buffer"].append(delta)
            # Try partial CTC in text-only mode (when no audio has been received yet)
            await self._try_partial_ctc(rid)
        else:
            # If we've already received audio, publish immediately; otherwise buffer
            if st.get("has_received_audio"):
                persona_id = await self._get_assistant_persona_id()
                if st["msg_id"] is None:
                    await self._ensure_assistant_message_exists(st, persona_id)

                await self.publish_text_chunk(
                    text=delta,
                    message_id=st["msg_id"],
                    chunk_idx=st["chunk_idx"],
                    is_final=False,
                    persona_id=persona_id,
                    voice=True,
                    parent_id=st["parent_id"],
                )
                # Now it's safe to thread the next user turn to this real message
                self.room.set_next_user_parent(st["msg_id"])
                st["chunk_idx"] += 1
            else:
                st["buffer"].append(delta)

    async def _handle_response_lifecycle(
        self, session: RealtimeSession, payload: dict[str, Any], evt_type: str
    ) -> None:
        """Handle response lifecycle events (created, interrupted, completed)."""
        rid = (
            payload.get("response_id")
            or (payload.get("response") or {}).get("id")
            or "_default"
        )

        # NEW RESPONSE starting?
        if evt_type in ("response.created", "response.started"):
            self._tts_blocked = False
            self._ensure_unblocked_and_draining()

            # Snapshot parent_id at response creation to avoid race conditions
            parent_user = self._resolve_parent_id(None)

            st = self._resp_streams.setdefault(
                rid,
                {
                    "msg_id": None,
                    "chunk_idx": 0,
                    "buffer": [],
                    "has_received_audio": False,
                    "partial_ctc_done": False,
                    "parent_id": parent_user,  # snapshotted at creation
                },
            )
            print(
                f"[assist:create] rid={rid} parent_snap={st['parent_id']} "
                f"anchor_open={self._user_anchor['open']} anchor_id={self._user_anchor['msg_id']} "
                f"last_user={self.room.last_user_id}"
            )
            # Remember latest response id for associating first audio chunks
            self._current_response_id = rid

        # Response interrupted/canceled?
        elif evt_type in ("response.interrupted", "response.canceled", "response.cancelled"):
            self._block_tts()
            try:
                await self._mark_interruption_for_active_response()
            except Exception:
                pass

            # Clean up pure placeholder on cancel/interruption
            try:
                for rid_k, st_k in list(self._resp_streams.items()):
                    mid_k = st_k.get("msg_id")
                    if not mid_k:
                        continue
                    no_text = not (
                        (st_k.get("last_flushed_text") or "").strip()
                        or "".join(st_k.get("buffer", [])).strip()
                    )
                    if int(st_k.get("chunk_idx") or 0) == 0 and no_text:
                        await self._delete_message_if_empty(str(mid_k))
            except Exception:
                pass

            if not self._resp_streams and self._pending_user_msgs:
                next_text = self._pending_user_msgs.pop(0)
                try:
                    await session.send_message(next_text)
                except Exception:
                    pass

    async def _handle_response_done(
        self, session: RealtimeSession, payload: dict[str, Any]
    ) -> None:
        """Handle response completion and finalization."""
        rid = (
            payload.get("response_id")
            or (payload.get("response") or {}).get("id")
            or "_default"
        )
        st = self._resp_streams.pop(rid, {})

        # Extract final text from payload
        final_text = None
        ot = payload.get("output_text")
        if not ot:
            resp_obj = payload.get("response") or {}
            ot = resp_obj.get("output_text")

        if isinstance(ot, str):
            final_text = ot
        elif isinstance(ot, dict):
            final_text = ot.get("text") or ot.get("content") or ""

        # Fall back to concatenated buffer
        if st:
            buffered_all = (st.get("last_flushed_text") or "") + "".join(
                st.get("buffer", [])
            )
            if not final_text or len(buffered_all) > len(final_text or ""):
                final_text = buffered_all

        # Trim and skip blank outputs
        final_text = (final_text or "").strip()
        
        # Fall back to buffered text if longer
        if st:
            buffered_all = (st.get("last_flushed_text") or "") + "".join(
                st.get("buffer", [])
            )
            if len(buffered_all.strip()) > len(final_text):
                final_text = buffered_all.strip()

        if final_text or (st and st.get("has_received_audio")):
            persona_id = await self._get_assistant_persona_id()
            if not st or st["msg_id"] is None:
                # One-shot finalization
                parent_snap = self._resolve_parent_id(st if st else None)
                msg_id = await self.publish_text_chunk(
                    text="",
                    message_id=None,
                    chunk_idx=0,
                    is_final=False,
                    persona_id=persona_id,
                    voice=True,
                    parent_id=parent_snap,
                )
                self.room.set_last_assistant(msg_id)
                self.room.set_next_user_parent(msg_id)
                self._rid_to_msg[rid] = msg_id
            else:
                # Check if we already streamed deltas for this message
                already_streamed = bool(st) and int(st.get("chunk_idx") or 0) > 0
                if already_streamed:
                    # We already persisted deltas; just finalize without adding text again
                    await self.publish_text_chunk(
                        text="",  # <- important: no duplicate content
                        message_id=st["msg_id"],
                        chunk_idx=st["chunk_idx"],
                        is_final=True,
                        persona_id=persona_id,
                        voice=True,
                        parent_id=st["parent_id"],
                    )
                else:
                    # Finalize existing message with full text (no prior deltas)
                    await self.publish_text_chunk(
                        text=final_text,
                        message_id=st["msg_id"],
                        chunk_idx=st["chunk_idx"],
                        is_final=True,
                        persona_id=persona_id,
                        voice=True,
                        parent_id=st["parent_id"],
                    )
                self._rid_to_msg[rid] = str(st["msg_id"])

        # FINAL CTC alignment and broadcast
        await self._run_final_ctc(rid, st, final_text)

        # Send queued user messages if any
        if not self._resp_streams and self._pending_user_msgs:
            next_text = self._pending_user_msgs.pop(0)
            try:
                await session.send_message(next_text)
            except Exception:
                pass

        # Cleanup accumulators
        self._resp_audio.pop(rid, None)
        self._resp_text.pop(rid, None)
        self._resp_audio_start_ts_ms.pop(rid, None)
        self._resp_audio_chunk_count.pop(rid, None)

    async def _run_final_ctc(
        self, rid: str, st: dict[str, Any] | None, final_text: str
    ) -> None:
        """Run final CTC alignment and broadcast transcript."""
        try:
            # Choose the most complete text
            deltas_joined = "".join(self._resp_text.get(rid, []))
            buffered_all = (
                ((st.get("last_flushed_text") if st else "") or "")
                + ("".join(st.get("buffer", [])) if st else "")
            )
            cand_payload = (final_text or "").strip()
            candidates = [cand_payload, deltas_joined.strip(), buffered_all.strip()]
            effective_text = (
                max(candidates, key=lambda s: len(s or "")) if any(candidates) else (final_text or "")
            )
            
            audio_arr = self._resp_audio.get(
                rid, self._resp_audio.get("_default", np.zeros(0, dtype=np.float32))
            )
            start_ts = self._resp_audio_start_ts_ms.get(rid, int(time.time() * 1000))
            
            if audio_arr is not None:
                tr_text, words, returned_audio = await self._align_ctc(
                    audio_f32=audio_arr, sr=PCM_SR, reference_text=effective_text, stage="final"
                )
                msg_id_final = self._rid_to_msg.get(rid)
                
                if words:
                    # Ensure message exists
                    if not msg_id_final:
                        st_final = self._resp_streams.get(rid, {})
                        if st_final and st_final.get("msg_id") is None:
                            persona_id = await self._get_assistant_persona_id()
                            await self._ensure_assistant_message_exists(st_final, persona_id)
                            msg_id_final = str(st_final["msg_id"])
                            self._rid_to_msg[rid] = msg_id_final
                    
                    await self.room.broadcast_transcript(
                        agent_id=self.id,
                        message_id=msg_id_final,
                        start_ts_ms=start_ts,
                        words=words,
                        full_text=tr_text or effective_text,
                    )
                    
                    # Thread next user turn
                    if st:
                        self.room.set_next_user_parent(st["msg_id"])
                    
                    # Persist to DB
                    await self._persist_word_timestamps(msg_id_final, words)
                    
                    # Finalize message with Whisper transcription content
                    if tr_text and msg_id_final:
                        # Finalize the message with Whisper transcription
                        await self.publish_text_chunk(
                            text=tr_text,
                            message_id=msg_id_final,
                            chunk_idx=0,
                            is_final=True,
                            persona_id=await self._get_assistant_persona_id(),
                            voice=True,
                            parent_id=st["parent_id"] if st else None,
                        )
                    
                    # Add returned audio to bus if available
                    if returned_audio is not None and returned_audio.size > 0:
                        # Chunk into 20ms pieces for streaming
                        chunk_size = SAMPLES_PER_CHUNK  # 960 samples = 20ms
                        for i in range(0, len(returned_audio), chunk_size):
                            chunk = returned_audio[i:i + chunk_size]
                            if len(chunk) > 0:
                                await self.publish_audio(chunk)
                                await asyncio.sleep(chunk_size / PCM_SR)  # 20ms pacing
        except Exception:
            pass

    async def _persist_word_timestamps(
        self, msg_id: str | None, words: list[dict[str, Any]]
    ) -> None:
        """Persist word-level timestamps to database."""
        try:
            if not (msg_id or "").strip():
                return

            from app.db import get_session as _get_session
            from app.models import Messages as _DBMsg
            from sqlmodel import select as _select

            def _persist_words() -> None:
                db = next(_get_session())
                try:
                    m = db.exec(_select(_DBMsg).where(_DBMsg.id == msg_id)).one_or_none()
                    if m is not None:
                        setattr(m, "word_timestamps", [
                            {
                                "start_ms": int(w.get("start_ms", 0)),
                                "end_ms": int(w.get("end_ms", 0)),
                                "text": str(w.get("text", "")),
                            }
                            for w in words
                        ])
                        db.add(m)
                        db.commit()
                        db.refresh(m)
                except Exception:
                    try:
                        db.rollback()
                    except Exception:
                        pass
                    raise
                finally:
                    try:
                        db.close()
                    except Exception:
                        pass

            import asyncio as _asyncio

            await _asyncio.to_thread(_persist_words)
        except Exception:
            pass

    async def _handle_user_transcript_delta(self, payload: dict[str, Any]) -> None:
        """Handle user live mic transcript deltas."""
        item_id = str(
            payload.get("item_id") or payload.get("conversation_item_id") or ""
        )
        delta = payload.get("delta") or ""
        if not item_id or not delta:
            return

        # Ensure anchor exists (rare: delta before speech_started)
        if not self._user_anchor["open"] or self._user_anchor["msg_id"] is None:
            parent = self.room.next_user_parent_id or self.room.last_assistant_id
            msg_id = await self.room.append_text_chunk(
                source_id="openai:user-transcript",
                role="user",
                text="",
                message_id=None,
                chunk_idx=0,
                is_final=False,
                persona_id=await self._get_user_persona_id(),
                voice=True,
                parent_id=parent,
            )
            self._user_anchor.update(
                {
                    "msg_id": msg_id,
                    "chunk_idx": 0,
                    "had_text": False,
                    "open": True,
                    "parent_id": parent,
                }
            )
            self._anchor_item_ids.clear()
        self._anchor_item_ids.add(item_id)

        await self.room.append_text_chunk(
            source_id="openai:user-transcript",
            role="user",
            text=delta,
            message_id=str(self._user_anchor["msg_id"])
            if self._user_anchor["msg_id"] is not None
            else None,
            chunk_idx=int(self._user_anchor["chunk_idx"])
            if self._user_anchor["chunk_idx"] is not None
            else 0,
            is_final=False,
            persona_id=await self._get_user_persona_id(),
            voice=True,
            parent_id=self._user_anchor.get("parent_id"),
        )
        self._user_anchor["chunk_idx"] = (self._user_anchor["chunk_idx"] or 0) + 1
        self._user_anchor["had_text"] = True

    async def _handle_user_transcript_completed(self, payload: dict[str, Any]) -> None:
        """Handle user transcript completion."""
        item_id = str(
            payload.get("item_id") or payload.get("conversation_item_id") or ""
        )
        transcript = (payload.get("transcript") or "").strip()

        if not self._user_anchor["open"] or self._user_anchor["msg_id"] is None:
            return

        # If final transcript arrives but we didn't stream deltas, append it once
        if transcript and not self._user_anchor["had_text"]:
            await self.room.append_text_chunk(
                source_id="openai:user-transcript",
                role="user",
                text=transcript,
                message_id=str(self._user_anchor["msg_id"])
                if self._user_anchor["msg_id"] is not None
                else None,
                chunk_idx=int(self._user_anchor["chunk_idx"])
                if self._user_anchor["chunk_idx"] is not None
                else 0,
                is_final=False,
                persona_id=await self._get_user_persona_id(),
                voice=True,
                parent_id=self._user_anchor.get("parent_id"),
            )
            self._user_anchor["chunk_idx"] = (self._user_anchor["chunk_idx"] or 0) + 1
            self._user_anchor["had_text"] = True

        # Only close the bubble when the *latest* item completes
        if item_id and self._latest_item_id and item_id == self._latest_item_id:
            if self._user_anchor["had_text"]:
                await self.room.append_text_chunk(
                    source_id="openai:user-transcript",
                    role="user",
                    text="",
                    message_id=str(self._user_anchor["msg_id"])
                    if self._user_anchor["msg_id"] is not None
                    else None,
                    chunk_idx=int(self._user_anchor["chunk_idx"])
                    if self._user_anchor["chunk_idx"] is not None
                    else 0,
                    is_final=True,
                    persona_id=await self._get_user_persona_id(),
                    voice=True,
                    parent_id=self._user_anchor.get("parent_id"),
                )
            # Reset single-anchor state
            self._user_anchor.update(
                {
                    "msg_id": None,
                    "chunk_idx": 0,
                    "had_text": False,
                    "open": False,
                    "parent_id": None,
                }
            )
            self._anchor_item_ids.clear()
            self._latest_item_id = None

    async def _handle_speech_started(self, payload: dict[str, Any]) -> None:
        """Handle speech start event (open user anchor)."""
        item_id = str(payload.get("item_id") or "")
        if not item_id:
            return

        # Open (or reuse) the single anchor
        if not self._user_anchor["open"]:
            parent = self.room.next_user_parent_id or self.room.last_assistant_id
            msg_id = await self.room.append_text_chunk(
                source_id="openai:user-transcript",
                role="user",
                text="",
                message_id=None,
                chunk_idx=0,
                is_final=False,
                persona_id=await self._get_user_persona_id(),
                voice=True,
                parent_id=parent,
            )
            self._user_anchor.update(
                {
                    "msg_id": msg_id,
                    "chunk_idx": 1,
                    "had_text": False,
                    "open": True,
                    "parent_id": parent,
                }
            )
            self._anchor_item_ids.clear()

        self._anchor_item_ids.add(item_id)
        self._latest_item_id = item_id

    async def _pump_model_events_out(self, session: RealtimeSession) -> None:
        """
        Listen to the model and forward audio + text back to the room.
        Delegates to specialized handler methods for each event type.
        """
        async for ev in session:
            try:
                # --- Audio events ---
                if isinstance(ev, OAEventAudio):
                    await self._handle_audio_event(ev)

                # --- Audio end ---
                elif isinstance(ev, OAEventAudioEnd):
                    pass  # Drainer will handle cleanup

                # --- Agent lifecycle ---
                elif isinstance(ev, OAEventAgentEnd):
                    pass  # All finalization via response.* events

                # --- Errors ---
                elif isinstance(ev, OAEventError):
                    raw_msg = getattr(ev, "error", None)
                    msg = str(raw_msg or "")
                    # Suppress benign warnings
                    if re.search(r"Audio content of \d+ms is already shorter than \d+ms", msg):
                        logger.debug("[openai] benign audio warning: %s", msg)
                        continue
                    logger.warning("[openai][error] %s", msg)

                # --- Interruptions ---
                elif isinstance(ev, OAEventAudioInterrupted):
                    self._block_tts()
                    try:
                        await self._mark_interruption_for_active_response()
                    except Exception:
                        pass

                # --- Raw server events (text deltas, lifecycle, transcripts) ---
                elif isinstance(ev, (OAEventRaw, OAEventRawServer, OAEventAgentStart)):
                    if isinstance(ev, OAEventAgentStart):
                        continue  # No action needed

                    # Extract payload
                    payload = None
                    if isinstance(ev, OAEventRawServer):
                        payload = getattr(ev, "data", {}) or {}
                    else:
                        raw = getattr(ev, "data", None)
                        if isinstance(raw, dict):
                            payload = raw.get("data", raw)
                        else:
                            rtype = getattr(raw, "type", "")
                            payload = getattr(raw, "data", {}) if rtype == "raw_server_event" else {}
                    
                    if not isinstance(payload, dict):
                        continue

                    evt_type = payload.get("type", "")

                    # Response lifecycle
                    if evt_type in ("response.created", "response.started", 
                                     "response.interrupted", "response.canceled", "response.cancelled"):
                        await self._handle_response_lifecycle(session, payload, evt_type)

                    # Text deltas
                    elif evt_type in ("response.output_text.delta", "response.text.delta", 
                                       "response.audio_transcript.delta", "response.delta"):
                        await self._handle_text_delta(session, payload, evt_type)

                    # Response completion
                    elif evt_type in ("response.audio_transcript.done", "response.completed", "response.done"):
                        await self._handle_response_done(session, payload)

                    # User transcript deltas
                    elif evt_type in ("conversation.item.input_audio_transcription.delta", "transcript_delta"):
                        await self._handle_user_transcript_delta(payload)

                    # User transcript complete
                    elif evt_type == "conversation.item.input_audio_transcription.completed":
                        await self._handle_user_transcript_completed(payload)

                    # Speech events
                    elif evt_type == "input_audio_buffer.speech_started":
                        await self._handle_speech_started(payload)

                    elif evt_type in ("input_audio_buffer.speech_stopped", "input_audio_buffer.committed"):
                        pass  # No action needed

                    elif evt_type == "conversation.item.created":
                        pass  # Only create on actual transcript deltas

            except Exception as ex:
                logger.exception(f"[openai][event-loop-exception] {ex}")

    # ---- agent lifecycle ----------------------------------------------------

    async def _run(self) -> None:
        # Create session
        self._session = await self._start_session()

        # NEW: wire text stream (no polling)
        self._wire_user_text_stream(self._session)

        # Pumps (audio in + model events out). No _pump_user_text_in.
        self._tasks = [
            asyncio.create_task(self._pump_audio_in(self._session)),
            asyncio.create_task(self._pump_model_events_out(self._session)),
        ]

        # Start uplink writer task
        self._uplink_task = asyncio.create_task(self._uplink_writer(self._session))
        self._tasks.append(self._uplink_task)

        # Wait until any task ends (or stop() cancels them)
        try:
            await asyncio.wait(self._tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
            await self._shutdown_session()

    async def _shutdown_session(self) -> None:
        self._running = False
        for t in self._tasks:
            try:
                t.cancel()
            except Exception:
                pass
        for t in self._tasks:
            try:
                await t
            except Exception:
                pass
        self._tasks.clear()
        if self._session:
            try:
                await self._session.__aexit__(None, None, None)
            except Exception:
                pass
            self._session = None
        # Close DB session to prevent connection pool leak
        if self._rtctx and self._rtctx.session:
            try:
                self._rtctx.session.close()
            except Exception:
                pass
            self._rtctx.session = None
        # Close pooled HTTP client
        if self._http_client:
            try:
                await self._http_client.aclose()
            except Exception:
                pass
            self._http_client = None


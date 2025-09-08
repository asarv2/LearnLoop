# server/app/agents/openai.py
from __future__ import annotations

import asyncio
import base64
import logging
import math
import os
import re
import time
import wave
from asyncio import QueueEmpty
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

import numpy as np
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
from agents.realtime.events import RealtimeHistoryAdded as OAEventHistoryAdded
from agents.realtime.events import \
    RealtimeHistoryUpdated as OAEventHistoryUpdated
from agents.realtime.events import RealtimeRawModelEvent as OAEventRaw
from agents.realtime.model_events import \
    RealtimeModelRawServerEvent as OAEventRawServer
from app.bus import PCM_SR, SAMPLES_PER_CHUNK
from app.db import get_session
from app.extensions import AUDIO_DIR
from app.models import Chats, Messages, Personas, Scenarios
from app.services.agents.voice.base import Agent
from app.store import list_messages
from app.utils.chat import (get_conversation_history, get_parameter_history,
                            get_preamble, get_text_formatted_instructions)
from sqlmodel import select

logger = logging.getLogger(__name__)



# ---------- audio helpers ----------

def _f32_to_s16le_bytes(x: np.ndarray) -> bytes:
    y = np.clip(x, -1.0, 1.0)
    return (y * 32767.0).astype(np.int16).tobytes()

def _s16le_bytes_to_f32(data: bytes) -> np.ndarray:
    return (np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0).clip(-1.0, 1.0)

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

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)

        self.model_name = "gpt-4o-mini-realtime-preview"
        self.voice_name = "alloy"

        td_type = "semantic_vad"
        self.turn_detection = {
            "type": td_type,
            # Let the server decide when to answer & allow barge-in
            "create_response": True,
            "interrupt_response": True,
            # give sane defaults; the server may ignore extras it doesn't use
            "eagerness": "auto"
        }

        # Audio formats the model expects/emits (pcm16 everywhere)
        self.input_sr = int(os.getenv("OPENAI_INPUT_SR", "24000"))  # set to 48000 to skip resample
        self.output_sr = 24000  # ← back to 24k (fixes chipmunk/high pitch)
        self._logged_audio_format = False  # optional: one-time debug print

        self._session: Optional[RealtimeSession] = None
        self._tasks: list[asyncio.Task] = []
        self._running = True
        self._seen_user_msg_ids: set[str] = set()
        
        # For streaming assistant deltas from OAEventRaw
        self._resp_streams: dict[str, dict[str, Any]] = {}  # response_id -> {msg_id, chunk_idx, buffer}
        # Single active user anchor (one bubble max)
        self._user_anchor: dict[str, Any] = {"msg_id": None, "chunk_idx": 0, "had_text": False, "open": False}
        self._anchor_item_ids: set[str] = set()          # all item_ids contributing to this anchor
        self._latest_item_id: Optional[str] = None        # last speech_started item_id

        # --- TTS hard mute + draining task ---
        self._tts_blocked: bool = False
        self._tts_drain_task: Optional[asyncio.Task] = None
        self._audio_buf = np.zeros(0, dtype=np.float32)  # shared TTS buffer
        
        # --- Pending user messages queue for barge-in ---
        self._pending_user_msgs: list[str] = []

        # --- Persona ID for assistant messages ---
        self._assistant_persona_id: Optional[str] = None

        # --- Uplink queue for decoupling audio capture from network I/O ---
        self._uplink_q: asyncio.Queue[bytes] = asyncio.Queue(maxsize=256)
        self._uplink_task: Optional[asyncio.Task] = None

        async def _audio_gate(chunk):
            # If blocked, turn any frame we publish into silence instantly.
            if self._tts_blocked:
                chunk.data[:] = 0.0
            return chunk
        self.audio_hook = _audio_gate



    def _block_tts(self):
        # Instant stop: mute, drop buffer, cancel drainer.
        self._tts_blocked = True
        self._audio_buf = np.zeros(0, dtype=np.float32)
        if self._tts_drain_task and not self._tts_drain_task.done():
            self._tts_drain_task.cancel()
        self._tts_drain_task = None

    def _ensure_unblocked_and_draining(self):
        if self._tts_blocked:
            # Stay blocked until a new response begins; caller decides when to unblock.
            return
        if self._tts_drain_task is None or self._tts_drain_task.done():
            self._tts_drain_task = asyncio.create_task(self._drain_tts())

    async def _get_assistant_persona_id(self) -> Optional[str]:
        """Get the assistant persona ID from the chat parameters."""
        if self._assistant_persona_id is not None:
            return self._assistant_persona_id
        
        try:
            from app.db import get_session
            from app.models import Chats
            from app.utils.chat import get_persona_id_from_chat
            from sqlmodel import select
            
            db_session = next(get_session())
            try:
                # Get the chat
                result = db_session.exec(
                    select(Chats).where(Chats.id == self.room.id)
                )
                chat = result.one_or_none()
                if not chat:
                    return None
                
                # Get persona ID from chat parameters
                persona_id = get_persona_id_from_chat(
                    db_session, 
                    str(chat.id), 
                    [str(pid) for pid in (chat.parameter_ids or [])]
                )
                
                if persona_id:
                    self._assistant_persona_id = str(persona_id)
                    return self._assistant_persona_id
                    
            finally:
                db_session.close()
        except Exception as e:
            logger.error(f"Error getting assistant persona ID: {str(e)}")
        
        return None

    async def _get_user_persona_id(self) -> Optional[str]:
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

    async def _drain_tts(self):
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

    async def _uplink_writer(self, session: RealtimeSession):
        try:
            while self._running:
                b = await self._uplink_q.get()
                try:
                    await session.send_audio(b, commit=False)
                finally:
                    self._uplink_q.task_done()
        except asyncio.CancelledError:
            pass

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

        async def wrapped(*, source_id: str, role: str, text: str,
                          message_id: str | None, chunk_idx: int, is_final: bool, persona_id: Optional[str] = None) -> str:
            # If a user anchor is open, route typed text into that message
            use_anchor = (
                role == "user"
                and source_id != TRANSCRIPT_SOURCE_ID
                and agent_self._user_anchor["open"]
                and agent_self._user_anchor["msg_id"] is not None
            )

            if use_anchor:
                message_id = str(agent_self._user_anchor["msg_id"]) if agent_self._user_anchor["msg_id"] is not None else None
                chunk_idx = int(agent_self._user_anchor["chunk_idx"]) if agent_self._user_anchor["chunk_idx"] is not None else 0

            # Get user persona_id if not provided for user messages
            if role == "user" and not persona_id:
                persona_id = await agent_self._get_user_persona_id()

            mid = await orig(
                source_id=source_id,
                role=role,
                text=text,
                message_id=message_id,
                chunk_idx=chunk_idx,
                is_final=is_final,
                persona_id=persona_id,
            )

            # 1) Local barge-in for ANY typed user chunk (not transcript)
            if role == "user" and source_id != TRANSCRIPT_SOURCE_ID:
                agent_self._block_tts()

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
                agent_self._user_anchor["chunk_idx"] = (agent_self._user_anchor["chunk_idx"] or 0) + 1

            return mid

        # Patch the instance method (doesn't interfere with socket broadcasting)
        setattr(self.room, 'append_text_chunk', wrapped)
        setattr(self.room, "_openai_text_hooked", True)

    # ---- session wiring -----------------------------------------------------

    async def _start_session(self) -> RealtimeSession:
        chat_id = self.room.id
        persona_id = await self._get_assistant_persona_id()

        db_session = next(get_session())

        chat: Optional[Chats] = db_session.exec(
            select(Chats).where(Chats.id == chat_id)
        ).one_or_none()

        if not chat:
            logger.error(f"Chat lookup failed for ID: {chat_id}")
            raise ValueError(f"Chat with ID {chat_id} not found")

        persona: Optional[Personas] = db_session.exec(
            select(Personas).where(Personas.id == persona_id)
        ).one_or_none()

        if not persona:
            logger.error(f"Persona lookup failed for ID: {persona_id}")
            raise ValueError(f"Persona with ID {persona_id} not found")

        logger.info(f"Found persona: Name='{persona.name}', Voice='{persona.voice}'")

        if not persona.realtime_prompt:
            logger.error(f"Persona '{persona.name}' has no realtime prompt.")
            raise ValueError(f"Persona with ID {persona_id} has no realtime prompt")

        # get all messages for the chat
        messages = db_session.exec(select(Messages).where(Messages.chat_id == chat_id)).all()
        
        # Get the scenario for the preamble
        if not chat.scenario_id:
            raise ValueError(f"Chat {chat_id} has no scenario_id")
        
        scenario = db_session.exec(select(Scenarios).where(Scenarios.id == chat.scenario_id)).one_or_none()
        if not scenario:
            raise ValueError(f"Scenario {chat.scenario_id} not found for chat {chat_id}")
        
        preamble = get_preamble(scenario)
        parameter_history = get_parameter_history(chat, db_session)
        conversation_history = get_conversation_history(messages)

        instructions = [preamble] + parameter_history
        conversation_history_realtime = get_text_formatted_instructions(conversation_history)

        realtime_instructions = persona.realtime_prompt + "\n" + get_text_formatted_instructions(instructions, history_format=False) + "\n" + conversation_history_realtime

        realtime_voice = persona.voice
        valid_voices = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"]
        if realtime_voice not in valid_voices:
            realtime_voice = "alloy"

        print(f"realtime_instructions: {realtime_instructions}")

        oa_agent = OARealtimeAgent(
            name="OpenAI Realtime",
            instructions=realtime_instructions,
        )

        model_settings: RealtimeSessionModelSettings = {
            "model_name": "gpt-4o-mini-realtime-preview",
            "modalities": ["text", "audio"],
            # ✅ Force 48k both directions
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "turn_detection": {
                "type": "semantic_vad",
                "create_response": True,
                "interrupt_response": True,
                "eagerness": "auto",
            },
            "voice": realtime_voice,
            "input_audio_transcription": {
                "model": "whisper-1"
            }
        }

        run_cfg = RealtimeRunConfig(model_settings=model_settings)

        runner = RealtimeRunner(oa_agent, config=run_cfg)
        session: RealtimeSession = await runner.run()
        session = await session.enter()   # ✅ correct way to enter
        logger.debug("[openai] realtime session started")
        return session

    # ---- pumps --------------------------------------------------------------

    async def _pump_audio_in(self, session: RealtimeSession) -> None:
        """
        Always send 20ms frames at self.input_sr. If no mic frame arrives before
        the deadline, send a zero (silence) frame. We do NOT call commit().
        """
        # --- Minimal capture: write exactly what we send (s16le) into a WAV ---
        wav = None
        wav_path = None
        if os.getenv("OPENAI_MIC_DUMP", "0") == "1":
            try:
                ts = int(time.time() * 1000)
                wav_path = (AUDIO_DIR / f"{ts}.wav")
                wav = wave.open(str(wav_path), "wb")
                # mono, 16-bit (2 bytes), self.input_sr
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(self.input_sr)
                print(f"[openai][mic-dump] capturing WAV to {wav_path} (sr={self.input_sr}, mono, s16le)")
            except Exception as e:
                print(f"[openai][mic-dump] failed to open file: {e}")

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
                timeout = 0.010 if remaining > 0 else 0.0
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
                        
                        # resample 48k → self.input_sr (24k) if needed
                        if self.input_sr != PCM_SR:             # 24000 vs 48000
                            # average pairs: (x[0:len-1:2] + x[1:len:2]) * 0.5
                            L2 = (x.size // 2) * 2
                            x = 0.5 * (x[:L2:2] + x[1:L2:2])

                        # optional: small preamp so VAD/ASR have healthy levels
                        pre_db = float(os.getenv("OPENAI_INPUT_PREAMP_DB", "18"))
                        if pre_db != 0.0:
                            x = np.clip(x * (10.0 ** (pre_db / 20.0)), -1.0, 1.0).astype(np.float32)

                        # ensure exact 20ms frame size at self.input_sr
                        if x.size < OUT_SAMPLES_PER_FRAME:
                            x = np.pad(x, (0, OUT_SAMPLES_PER_FRAME - x.size))
                        elif x.size > OUT_SAMPLES_PER_FRAME:
                            x = x[:OUT_SAMPLES_PER_FRAME]

                        b = _f32_to_s16le_bytes(x)
                        t_b1 = time.perf_counter()

                        if os.getenv("OPENAI_DEBUG", "0") == "1" and n % 100 == 0:
                            rms = float(np.sqrt(np.mean(x * x)) + 1e-12)
                            print(f"[openai][mic-dump] len_f32={x.size} len_bytes={len(b)} rms_post={rms:.6f} preamp_db={pre_db}")

                except asyncio.TimeoutError:
                    # No bus chunk before the deadline → send silence
                    b = SILENCE_BYTES
                    t_a0 = t_a1 = t_b0 = t_b1 = time.perf_counter()

                # Send upstream via queue (NO commit)
                try:
                    self._uplink_q.put_nowait(b)
                except asyncio.QueueFull:
                    # drop oldest to keep latency tight
                    try:
                        _ = self._uplink_q.get_nowait()
                        self._uplink_q.task_done()
                    except asyncio.QueueEmpty:
                        pass
                    self._uplink_q.put_nowait(b)

                if n % 50 == 0:
                    logger.debug(f"[pump] recv={(t_a1-t_a0)*1000:.1f}ms proc={(t_b1-t_b0)*1000:.1f}ms send=queue")

                # Optional WAV dump of exactly what we sent
                if wav is not None:
                    try:
                        wav.writeframes(b)
                    except Exception:
                        pass

                n += 1
                if n % 100 == 0:
                    dt = time.time() - t0
                    if dt > 0:
                        logger.debug(f"[openai] audio→model {n} frames (~{n*FRAME_SEC:.1f}s) in {dt:.1f}s")

                # Maintain pacing if we're early
                remaining = next_deadline - time.perf_counter()
                if remaining < -0.02:
                    # we fell behind by >1 frame → reset schedule
                    next_deadline = time.perf_counter()
                elif remaining > 0:
                    await asyncio.sleep(remaining)

        finally:
            if wav is not None:
                try:
                    wav.close()
                    logger.debug(f"[openai][mic-dump] saved to {wav_path}")
                except Exception:
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

    async def _pump_model_events_out(self, session: RealtimeSession) -> None:
        """
        Listen to the model and forward audio + text back to the room.
        - Audio events: convert pcm16 → float32, resample to 48k, chunk to 20ms, publish.
        - History events: when assistant output text appears, stream to chat.
        """
        # For streaming assistant text
        active_msg_id: Optional[str] = None
        next_chunk_idx = 0

        async for ev in session:
            try:
                # --- Audio started/continued ---
                if isinstance(ev, OAEventAudio):
                    # Small guard to prevent endless mute
                    if self._tts_blocked:
                        self._tts_blocked = False
                        self._ensure_unblocked_and_draining()
                    
                    # bytes or base64 string depending on SDK/version
                    audio_bytes = getattr(ev.audio, "audio", None) \
                               or getattr(ev.audio, "data", None) \
                               or getattr(ev.audio, "bytes", None)
                    if audio_bytes is None:
                        continue
                    if isinstance(audio_bytes, str):
                        try:
                            audio_bytes = base64.b64decode(audio_bytes)
                        except Exception:
                            continue
                    if not isinstance(audio_bytes, (bytes, bytearray)):
                        continue

                    f32 = _s16le_bytes_to_f32(audio_bytes)

                    # Optional: log once so you can see what the model really sends
                    if not self._logged_audio_format:
                        logger.debug(f"[openai] model audio: sr={self.output_sr}Hz, bytes={len(audio_bytes)}")
                        self._logged_audio_format = True

                    # Resample to the bus rate (48k) if needed
                    if self.output_sr != PCM_SR:
                        f32 = _resample_linear(f32, self.output_sr, PCM_SR)

                    # Append to shared buffer and (re)start the drainer if not blocked
                    self._audio_buf = np.concatenate([self._audio_buf, f32])
                    self._ensure_unblocked_and_draining()

                # --- Audio finished (flush any micro tail just in case) ---
                elif isinstance(ev, OAEventAudioEnd):
                    # Optional: drop any micro tail; the drainer will exit when buffer empties.
                    pass 

                # --- Agent end (close text message cleanly) ---
                elif isinstance(ev, OAEventAgentEnd):
                    if active_msg_id is not None:
                        persona_id = await self._get_assistant_persona_id()
                        await self.publish_text_chunk(
                            text="",
                            message_id=active_msg_id,
                            chunk_idx=next_chunk_idx,
                            is_final=True,
                            persona_id=persona_id,
                        )
                        active_msg_id = None
                        next_chunk_idx = 0

                elif isinstance(ev, OAEventError):
                    raw_msg = getattr(ev, "error", None)
                    msg = str(raw_msg or "")
                    # Suppress the benign cursor-length warning
                    if re.search(r"Audio content of \d+ms is already shorter than \d+ms", msg):
                        logger.debug("[openai] benign audio warning: %s", msg)
                        continue
                    logger.warning("[openai][error] %s", msg)
                    # (optional) show real errors in chat, or just log them:
                    # await self.publish_text_chunk(text=f"(openai error) {msg}", message_id=None, chunk_idx=0, is_final=True)

                # (optional) Log/ignore others
                elif isinstance(ev, (OAEventRaw, OAEventRawServer, OAEventAudioInterrupted, OAEventAgentStart)):
                    # Instant stop on user barge-in
                    if isinstance(ev, OAEventAudioInterrupted):
                        self._block_tts()

                    # Handle raw events for streaming deltas
                    if isinstance(ev, (OAEventRaw, OAEventRawServer)):
                        payload = None
                        if isinstance(ev, OAEventRawServer):
                            # direct server event → ev.data is already a dict
                            payload = getattr(ev, "data", {}) or {}
                        else:
                            raw = getattr(ev, "data", None)
                            if isinstance(raw, dict):
                                # some builds nest under {"type":"raw_server_event","data":{...}}
                                payload = raw.get("data", raw)
                            else:
                                rtype = getattr(raw, "type", "")
                                payload = getattr(raw, "data", {}) if rtype == "raw_server_event" else {}
                        if not isinstance(payload, dict):
                            continue

                        evt_type = payload.get("type", "")
                        
                        # print(f"[openai] server evt: {payload.get('type')}")
                        
                        # NEW RESPONSE starting? Unblock + start draining but DON'T create a placeholder yet
                        if evt_type in ("response.created", "response.started"):
                            self._tts_blocked = False
                            self._ensure_unblocked_and_draining()

                            rid = payload.get("response_id") or (payload.get("response") or {}).get("id") or "_default"
                            # Track it but DON'T create a room message yet - wait for actual text
                            self._resp_streams.setdefault(rid, {"msg_id": None, "chunk_idx": 0, "buffer": []})

                        # Current response got interrupted/canceled? Hard stop now.
                        if evt_type in ("response.interrupted", "response.canceled", "response.cancelled"):
                            self._block_tts()
                            if not self._resp_streams and self._pending_user_msgs:
                                next_text = self._pending_user_msgs.pop(0)
                                try:
                                    await session.send_message(next_text)
                                except Exception:
                                    pass

                        # --- Assistant streaming text / transcript deltas ---
                        if evt_type in ("response.output_text.delta", "response.text.delta", "response.audio_transcript.delta"):
                            rid = payload.get("response_id") or (payload.get("response") or {}).get("id") or "_default"
                            delta = payload.get("delta", "") or ""
                            if not delta:
                                continue

                            st = self._resp_streams.setdefault(rid, {"msg_id": None, "chunk_idx": 0, "buffer": []})
                            # Create the message lazily on first actual text
                            persona_id = await self._get_assistant_persona_id()
                            if st["msg_id"] is None:
                                st["msg_id"] = await self.publish_text_chunk(text="", message_id=None, chunk_idx=0, is_final=False, persona_id=persona_id)

                            st["buffer"].append(delta)
                            await self.publish_text_chunk(
                                text=delta,
                                message_id=st["msg_id"],
                                chunk_idx=st["chunk_idx"],
                                is_final=False,
                                persona_id=persona_id,
                            )
                            st["chunk_idx"] += 1

                        elif evt_type == "response.delta":
                            delta = payload.get("delta", "")
                            if not delta:
                                ot = payload.get("output_text")
                                if isinstance(ot, dict):
                                    delta = ot.get("delta", "") or ""
                            if delta:
                                rid = payload.get("response_id") or (payload.get("response") or {}).get("id") or "_default"
                                st = self._resp_streams.setdefault(rid, {"msg_id": None, "chunk_idx": 0, "buffer": []})
                                # Create the message lazily on first actual text
                                persona_id = await self._get_assistant_persona_id()
                                if st["msg_id"] is None:
                                    st["msg_id"] = await self.publish_text_chunk(text="", message_id=None, chunk_idx=0, is_final=False, persona_id=persona_id)
                                st["buffer"].append(delta)
                                await self.publish_text_chunk(
                                    text=delta,
                                    message_id=st["msg_id"],
                                    chunk_idx=st["chunk_idx"],
                                    is_final=False,
                                    persona_id=persona_id,
                                )
                                st["chunk_idx"] += 1

                        # --- Assistant done/finalize ---
                        elif evt_type in ("response.output_text.done", "response.text.done", "response.audio_transcript.done",
                                          "response.completed", "response.done"):
                            rid = payload.get("response_id") or (payload.get("response") or {}).get("id") or "_default"
                            st = self._resp_streams.pop(rid, {})

                            # If there were no deltas, many servers put the full text here
                            final_text = None
                            # common shapes:
                            #  - payload["output_text"] as str
                            #  - payload["output_text"] as dict with "text" or "content"
                            #  - payload["response"]["output_text"] as str/dict
                            ot = payload.get("output_text")
                            if not ot:
                                resp_obj = payload.get("response") or {}
                                ot = resp_obj.get("output_text")

                            if isinstance(ot, str):
                                final_text = ot
                            elif isinstance(ot, dict):
                                final_text = ot.get("text") or ot.get("content") or ""

                            # Fall back to concatenated buffer (if deltas were streamed)
                            if not final_text and st and st.get("buffer"):
                                final_text = "".join(st["buffer"])

                            if final_text:
                                # if we never created a message, do a one-shot create+finalize now
                                persona_id = await self._get_assistant_persona_id()
                                if not st or st["msg_id"] is None:
                                    msg_id = await self.publish_text_chunk(text="", message_id=None, chunk_idx=0, is_final=False, persona_id=persona_id)
                                    await self.publish_text_chunk(text=final_text, message_id=msg_id, chunk_idx=0, is_final=True, persona_id=persona_id)
                                else:
                                    await self.publish_text_chunk(text="", message_id=st["msg_id"], chunk_idx=st["chunk_idx"], is_final=True, persona_id=persona_id)
                            else:
                                # no text at all → do nothing (no blank bubble)
                                pass
                            
                            # If there are pending typed user turns (queued during barge-in),
                            # and no other responses remain active, send the next one now.
                            if not self._resp_streams and self._pending_user_msgs:
                                next_text = self._pending_user_msgs.pop(0)
                                try:
                                    await session.send_message(next_text)
                                except Exception:
                                    pass
                            


                        # --- User live mic transcript (stream into chat) ---
                        elif evt_type in ("conversation.item.input_audio_transcription.delta", "transcript_delta"):
                            print(f"[openai] transcript_delta: {ev}")
                            item_id = str(payload.get("item_id") or payload.get("conversation_item_id") or "")
                            delta = payload.get("delta") or ""
                            if not item_id or not delta:
                                continue

                            # Ensure anchor exists (rare: delta before speech_started)
                            if not self._user_anchor["open"] or self._user_anchor["msg_id"] is None:
                                msg_id = await self.room.append_text_chunk(
                                    source_id="openai:user-transcript",
                                    role="user",
                                    text="",
                                    message_id=None,
                                    chunk_idx=0,
                                    is_final=False,
                                    persona_id=await self._get_user_persona_id(),
                                )
                                self._user_anchor.update({"msg_id": msg_id, "chunk_idx": 0, "had_text": False, "open": True})
                                self._anchor_item_ids.clear()
                            self._anchor_item_ids.add(item_id)

                            await self.room.append_text_chunk(
                                source_id="openai:user-transcript",
                                role="user",
                                text=delta,
                                message_id=str(self._user_anchor["msg_id"]) if self._user_anchor["msg_id"] is not None else None,
                                chunk_idx=int(self._user_anchor["chunk_idx"]) if self._user_anchor["chunk_idx"] is not None else 0,
                                is_final=False,
                                persona_id=await self._get_user_persona_id(),
                            )
                            self._user_anchor["chunk_idx"] = (self._user_anchor["chunk_idx"] or 0) + 1
                            self._user_anchor["had_text"] = True

                        elif evt_type == "conversation.item.input_audio_transcription.completed":
                            item_id = str(payload.get("item_id") or payload.get("conversation_item_id") or "")
                            transcript = (payload.get("transcript") or "").strip()

                            if not self._user_anchor["open"] or self._user_anchor["msg_id"] is None:
                                continue  # nothing to finalize

                            # If a final transcript arrives but we didn't stream deltas, append it once
                            if transcript and not self._user_anchor["had_text"]:
                                await self.room.append_text_chunk(
                                    source_id="openai:user-transcript",
                                    role="user",
                                    text=transcript,
                                    message_id=str(self._user_anchor["msg_id"]) if self._user_anchor["msg_id"] is not None else None,
                                    chunk_idx=int(self._user_anchor["chunk_idx"]) if self._user_anchor["chunk_idx"] is not None else 0,
                                    is_final=False,
                                    persona_id=await self._get_user_persona_id(),
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
                                        message_id=str(self._user_anchor["msg_id"]) if self._user_anchor["msg_id"] is not None else None,
                                        chunk_idx=int(self._user_anchor["chunk_idx"]) if self._user_anchor["chunk_idx"] is not None else 0,
                                        is_final=True,
                                        persona_id=await self._get_user_persona_id(),
                                    )
                                # Reset single-anchor state (whether we wrote text or not)
                                self._user_anchor.update({"msg_id": None, "chunk_idx": 0, "had_text": False, "open": False})
                                self._anchor_item_ids.clear()
                                self._latest_item_id = None
                            # else: earlier item completed; ignore (we're still collecting into the same anchor)


                        # --- Speech events ---
                        elif evt_type == "input_audio_buffer.speech_started":
                            item_id = str(payload.get("item_id") or "")
                            if not item_id:
                                continue

                            # Open (or reuse) the single anchor
                            if not self._user_anchor["open"]:
                                msg_id = await self.room.append_text_chunk(
                                    source_id="openai:user-transcript",
                                    role="user",
                                    text="",
                                    message_id=None,
                                    chunk_idx=0,
                                    is_final=False,
                                    persona_id=await self._get_user_persona_id(),
                                )
                                self._user_anchor.update({"msg_id": msg_id, "chunk_idx": 0, "had_text": False, "open": True})
                                self._anchor_item_ids.clear()

                            self._anchor_item_ids.add(item_id)
                            self._latest_item_id = item_id

                        elif evt_type in ("input_audio_buffer.speech_stopped", "input_audio_buffer.committed"):
                            if evt_type == "input_audio_buffer.speech_stopped":
                                print(f"[openai] speech_stopped: {ev}")
                            # No-op; placeholder already opened on speech_started
                            pass

                        elif evt_type == "conversation.item.created":
                            # When the server materializes the user item (role=user, type=message)
                            # No longer creating placeholders here - only on actual transcript deltas
                            pass
                    # You can print(ev) for debugging if needed.
                    pass
            except Exception as ex:
                print(f"[openai][event-loop-exception] {ex}")

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

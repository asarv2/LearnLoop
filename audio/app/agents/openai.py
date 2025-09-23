from __future__ import annotations

import asyncio
import base64
import logging
import os
import re
import time
from typing import Any, Dict, Optional, cast

import numpy as np
from agents.realtime import RealtimeAgent as OARealtimeAgent
from agents.realtime import RealtimeRunner, RealtimeSession
from agents.realtime.config import (RealtimeRunConfig,
                                    RealtimeSessionModelSettings)
from agents.realtime.events import RealtimeAgentEndEvent as OAEventAgentEnd
from agents.realtime.events import RealtimeAudio as OAEventAudio
from agents.realtime.events import RealtimeAudioEnd as OAEventAudioEnd
from agents.realtime.events import RealtimeRawModelEvent as OAEventRaw
from agents.realtime.model_events import \
    RealtimeModelRawServerEvent as OAEventRawServer
from app.agents.base import Agent
from app.bus import PCM_SR, SAMPLES_PER_CHUNK
from app.store import list_messages
from app.transcripts import align_via_model_service

log = logging.getLogger("openai.agent")


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


class OpenAIAgent(Agent):
    def __init__(self, *args: Any, instructions: str = "Be helpful.", voice_name: str = "alloy", **kwargs: Any):
        super().__init__(*args, **kwargs)
        self.instructions = instructions
        self.voice_name = voice_name

        self.model_name = os.getenv("OPENAI_REALTIME_MODEL", "gpt-4o-mini-realtime-preview")
        self.input_sr = 24000
        self.output_sr = 24000

        self._session: Optional[RealtimeSession] = None
        self._tasks: list[asyncio.Task] = []
        self._running = True
        self._session_ready: asyncio.Event = asyncio.Event()

        # audio streaming buffer
        self._audio_buf = np.zeros(0, dtype=np.float32)
        self._tts_blocked = False
        self._drain_task: Optional[asyncio.Task] = None
        self._audio_buf_max_samples = PCM_SR * 120  # cap ~120s to prevent OOM

        # per-response accumulation for alignment
        self._resp_audio: dict[str, np.ndarray] = {}
        self._resp_text: dict[str, list[str]] = {}
        self._resp_audio_start_ts_ms: dict[str, int] = {}
        self._rid_to_msg: dict[str, str] = {}   # response_id -> message_id
        self._current_msg_id: Optional[str] = None  # single active assistant bubble
        self._processed_done: set[str] = set()   # responses we've already finalized

        # gate text streaming (re-enabled to ensure messages appear even if no final text is sent)
        self._text_stream_allowed: bool = True

        # per-response gate for announcing output start
        self._announced_output = False

        # diagnostics: track whether this agent currently hears the beep
        self._beep_heard = False
        # suppress next TTS output if we want a text-only response
        self._suppress_next_tts = False

        async def _audio_gate(chunk: Any) -> Any:
            if self._tts_blocked:
                chunk.data[:] = 0.0
            return chunk

        self.audio_hook = _audio_gate

        # Register an interrupt handler to hard-stop audio and clear state
        try:
            async def _interrupt() -> None:
                log.info(f"Agent {self.id} interrupted - clearing state")
                self._block_tts()
                self._resp_audio.clear()
                self._resp_text.clear()
                self._resp_audio_start_ts_ms.clear()
                self._rid_to_msg.clear()
                self._current_msg_id = None
                self._processed_done.clear()
            self.room.register_interrupt_handler(self.id, _interrupt)
            # fast-flush removed
        except Exception:
            pass

    async def _start_session(self) -> RealtimeSession:
        log.info(f"Starting OpenAI session for agent {self.id}")
        oa_agent = OARealtimeAgent(name="OpenAI Realtime", instructions=self.instructions)
        model_settings: RealtimeSessionModelSettings = {
            "model_name": self.model_name,
            "modalities": ["text", "audio"],
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "turn_detection": {
                "type": "semantic_vad",
                "create_response": True,
                "interrupt_response": True,
                "eagerness": "auto",
            },
            "voice": self.voice_name,
            "tracing": {
                "workflow_name": self.id.split(":", 1)[-1],
            }
        }
        run_cfg = RealtimeRunConfig(model_settings=model_settings)
        runner = RealtimeRunner(oa_agent, config=run_cfg)
        session: RealtimeSession = await runner.run()
        session = await session.enter()
        log.info(f"OpenAI session started for agent {self.id}")
        return session

    def _ensure_drainer(self) -> None:
        if self._tts_blocked:
            return
        if self._drain_task is None or self._drain_task.done():
            self._drain_task = asyncio.create_task(self._drain_audio())

    def _block_tts(self) -> None:
        self._tts_blocked = True
        self._audio_buf = np.zeros(0, dtype=np.float32)
        if self._drain_task and not self._drain_task.done():
            self._drain_task.cancel()
        self._drain_task = None

    async def _drain_audio(self) -> None:
        try:
            while self._running and not self._tts_blocked:
                if len(self._audio_buf) < SAMPLES_PER_CHUNK:
                    await asyncio.sleep(0.002)
                    continue
                frame = self._audio_buf[: SAMPLES_PER_CHUNK]
                self._audio_buf = self._audio_buf[SAMPLES_PER_CHUNK :]
                await self.publish_audio((frame * 0.85).astype(np.float32))
                await asyncio.sleep(SAMPLES_PER_CHUNK / PCM_SR)
        except asyncio.CancelledError:
            pass

    # fast-flush removed; rely on natural drainer pacing

    async def _pump_audio_in(self, session: RealtimeSession) -> None:
        FRAME_SEC = 0.020
        OUT_SAMPLES_PER_FRAME = int(round(self.input_sr * FRAME_SEC))
        SILENCE_F32 = np.zeros(OUT_SAMPLES_PER_FRAME, dtype=np.float32)
        SILENCE_BYTES = _f32_to_s16le_bytes(SILENCE_F32)

        next_deadline = time.perf_counter()
        while self._running:
            next_deadline += FRAME_SEC
            b = SILENCE_BYTES
            try:
                timeout = max(0.0, next_deadline - time.perf_counter() + 0.005)
                chunk = await asyncio.wait_for(self.sub.recv(), timeout=timeout)
                x = chunk.data
                try:
                    # Detect whether the current mixed chunk delivered to this agent includes the beep
                    includes_beep = bool(getattr(chunk, "meta", {}).get("includes_beep", False))
                    if includes_beep and not self._beep_heard:
                        self._beep_heard = True
                        log.info(f"beep: {self.id} now hearing beep (sources={getattr(chunk, 'meta', {}).get('sources', [])})")
                    elif (not includes_beep) and self._beep_heard:
                        self._beep_heard = False
                        log.info(f"beep: {self.id} beep off")
                except Exception:
                    pass
                if x is None or x.size == 0:
                    b = SILENCE_BYTES
                else:
                    if self.input_sr != PCM_SR:
                        x = _resample_linear(x, PCM_SR, self.input_sr)
                    if x.size < OUT_SAMPLES_PER_FRAME:
                        x = np.pad(x, (0, OUT_SAMPLES_PER_FRAME - x.size))
                    elif x.size > OUT_SAMPLES_PER_FRAME:
                        x = x[:OUT_SAMPLES_PER_FRAME]
                    b = _f32_to_s16le_bytes(x)
            except asyncio.TimeoutError:
                b = SILENCE_BYTES
            try:
                await session.send_audio(b, commit=False)
            except Exception:
                pass
            remaining = next_deadline - time.perf_counter()
            if remaining > 0:
                await asyncio.sleep(remaining)

    def _extract_text_from_payload(self, payload: Dict[str, Any]) -> str:
        """
        Best-effort extraction of assistant text from various payload shapes.
        Handles: payload["output_text"] as str/dict, payload["response"]["output_text"],
        and falls back to simple string fields if present.
        """
        def pluck(obj: Any) -> str:
            if isinstance(obj, str):
                return obj
            if isinstance(obj, dict):
                for key in ("text", "content", "final", "value"):
                    v = obj.get(key)
                    if isinstance(v, str) and v.strip():
                        return v
            return ""

        # direct output_text
        ot = payload.get("output_text")
        txt = pluck(ot)
        if txt:
            return txt
        # nested under response
        resp = payload.get("response") or {}
        txt = pluck(resp.get("output_text"))
        if txt:
            return txt
        # sometimes servers place text directly on response
        txt = pluck(resp)
        return txt or ""

    async def _pump_events(self, session: RealtimeSession) -> None:
        async for ev in session:
            try:
                if isinstance(ev, OAEventAudio):
                    # If we are suppressing the next TTS, drop audio frames on the floor
                    if self._suppress_next_tts:
                        continue
                    audio_bytes = (
                        getattr(ev.audio, "audio", None)
                        or getattr(ev.audio, "data", None)
                        or getattr(ev.audio, "bytes", None)
                    )
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
                    if self.output_sr != PCM_SR:
                        f32 = _resample_linear(f32, self.output_sr, PCM_SR)
                    # append to shared drainer buffer for streaming
                    self._audio_buf = np.concatenate([self._audio_buf, f32])
                    # cap buffer growth
                    if self._audio_buf.size > self._audio_buf_max_samples:
                        over = self._audio_buf.size - self._audio_buf_max_samples
                        # drop the oldest samples to preserve the most recent content
                        self._audio_buf = self._audio_buf[over:]
                    self._tts_blocked = False
                    self._ensure_drainer()
                    # first audio frame for this response: mark as speaking
                    if not self._announced_output:
                        self._announced_output = True
                        log.info(f"Agent {self.id} starting audio output")
                        try:
                            activator = getattr(self.room, "activate_agent_output", None)
                            if callable(activator):
                                activator(self.id)
                            notifier = getattr(self.room, "on_agent_response_started", None)
                            if callable(notifier):
                                await notifier(self.id)
                        except Exception:
                            pass
                        # When word timestamps are enabled and we suppress deltas, create a placeholder message now
                        # so the transcript can attach without flashing interim text.
                        try:
                            if bool(getattr(self.room, "word_timestamps_enabled", True)) and (self._current_msg_id is None):
                                msg_id = await self.publish_text_chunk(text="", message_id=None, chunk_idx=0, is_final=False)
                                self._current_msg_id = msg_id
                        except Exception:
                            pass
                    # also accumulate per-response buffer for alignment
                    rid = getattr(getattr(ev, "audio", object()), "response_id", None) or "_default"
                    # Ensure rid->message mapping exists so completion can find the message id
                    try:
                        if bool(getattr(self.room, "word_timestamps_enabled", True)) and (rid not in self._rid_to_msg) and self._current_msg_id:
                            self._rid_to_msg[rid] = self._current_msg_id
                    except Exception:
                        pass
                    buf = self._resp_audio.get(rid)
                    self._resp_audio[rid] = (
                        np.concatenate([buf, f32]) if isinstance(buf, np.ndarray) else np.copy(f32)
                    )
                    if rid not in self._resp_audio_start_ts_ms:
                        self._resp_audio_start_ts_ms[rid] = int(time.time() * 1000)

                elif isinstance(ev, OAEventAudioEnd):
                    # End of audio segment for this response
                    pass

                elif isinstance(ev, (OAEventRaw, OAEventRawServer)):
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

                    # ---- STREAMING DELTAS (cover common variants) ----
                    if evt_type in ("response.output_text.delta", "response.text.delta", "response.delta", "response.audio_transcript.delta"):
                        rid = payload.get("response_id") or (payload.get("response") or {}).get("id") or "_default"
                        delta = payload.get("delta", "") or ""
                        if not delta:
                            # some servers nest the delta under output_text
                            ot = payload.get("output_text")
                            if isinstance(ot, dict):
                                delta = ot.get("delta", "") or ""
                        if not delta:
                            continue
                        # sanitize once at the end; for now just buffer
                        self._resp_text.setdefault(rid, []).append(
                            re.sub(r"^\s*(Ashok|User)\s*:\s*", "", delta, flags=re.IGNORECASE)
                        )

                        # OPTIONAL: stream to UI live
                        # Suppress assistant delta streaming when word-level timestamps are enabled to avoid
                        # confusing jumps; the final aligned transcript will be broadcast later.
                        if self._text_stream_allowed and not bool(getattr(self.room, "word_timestamps_enabled", True)):
                            msg_id_opt: Optional[str] = self._rid_to_msg.get(rid) or self._current_msg_id
                            if msg_id_opt is None:
                                # create one placeholder for the entire active assistant bubble
                                msg_id_new = await self.publish_text_chunk(text="", message_id=None, chunk_idx=0, is_final=False)
                                self._current_msg_id = msg_id_new
                                msg_id_opt = msg_id_new
                            # keep mapping for this response id
                            self._rid_to_msg[rid] = cast(str, msg_id_opt)
                            await self.publish_text_chunk(text=delta, message_id=cast(str, msg_id_opt), chunk_idx=len(self._resp_text[rid])-1, is_final=False)

                    # ---- DONE / COMPLETED ----
                    elif evt_type in ("response.completed","response.done"):
                        rid = payload.get("response_id") or (payload.get("response") or {}).get("id") or "_default"
                        log.info(f"Agent response completed: rid={rid}, processed_done={rid in self._processed_done}")
                        if rid in self._processed_done:
                            # already finalized this response id
                            log.info(f"Skipping already processed response: {rid}")
                            continue
                        # 1) best-effort final text from payload
                        final_text = self._extract_text_from_payload(payload)
                        had_deltas = len(self._resp_text.get(rid, [])) > 0
                        joined = "".join(self._resp_text.get(rid, [])) if had_deltas else ""
                        # Prefer the more complete text between payload final and joined deltas
                        cand_payload = (final_text or "").strip()
                        cand_joined = joined.strip()
                        effective_text = cand_payload if (len(cand_payload) >= len(cand_joined)) else cand_joined

                        # Give a tiny moment for any trailing audio frame to arrive (keep small)
                        try:
                            await asyncio.sleep(0.02)
                        except Exception:
                            pass
                        # Gather audio + start time
                        audio_arr = self._resp_audio.get(rid, None)
                        if audio_arr is None:
                            audio_arr = self._resp_audio.get("_default", None)
                        if audio_arr is None:
                            audio_arr = np.zeros(0, dtype=np.float32)
                        start_ts = self._resp_audio_start_ts_ms.get(rid, int(time.time() * 1000))
                        try:
                            getter = getattr(self.room, "get_agent_playback_start_ts", None)
                            if callable(getter):
                                start_ts = getter(self.id) or start_ts
                        except Exception:
                            pass

                        # Publish to chat
                        msg_id_final: Optional[str] = (self._rid_to_msg.pop(rid) if rid in self._rid_to_msg else None) or self._current_msg_id
                        if not bool(getattr(self.room, "word_timestamps_enabled", True)):
                            if had_deltas and msg_id_final is not None:
                                # we already streamed deltas → just finalize the existing message
                                await self.publish_text_chunk(text="", message_id=msg_id_final, chunk_idx=9999, is_final=True)
                            else:
                                # no deltas streamed → create one-shot final message if we have text
                                if (effective_text or "").strip():
                                    msg_id_new2 = await self.publish_text_chunk(text=effective_text, message_id=None, chunk_idx=0, is_final=True)
                                    msg_id_final = msg_id_new2
                        else:
                            # word_timestamps enabled: ensure a placeholder exists if none yet
                            if msg_id_final is None:
                                try:
                                    msg_id_new3 = await self.publish_text_chunk(text="", message_id=None, chunk_idx=0, is_final=False)
                                    msg_id_final = msg_id_new3
                                except Exception:
                                    pass
                            # If we have final text but no audio/words to align, still persist final text
                            if (effective_text or "").strip():
                                try:
                                    await self.publish_text_chunk(text=effective_text, message_id=msg_id_final or None, chunk_idx=9999, is_final=True)
                                except Exception:
                                    pass
                        # clear current active message id if it matches
                        if msg_id_final and self._current_msg_id == msg_id_final:
                            self._current_msg_id = None

                        # Handover ASAP: notify room now (before alignment) so beep is audible immediately
                        try:
                            await self.room.notify_agent_text_finalized(self.id, effective_text)
                        except Exception:
                            pass

                        # Word timestamps (align only if we have reference text and non-empty audio)
                        words_payload = []
                        tr_text = (effective_text or "").strip()
                        # Prefer the exact text that was stored for the message (what the UI displays)
                        try:
                            if (msg_id_final or "").strip():
                                # small delay to ensure final chunk is committed
                                await asyncio.sleep(0.01)
                                msgs = list_messages(self.room.id)
                                for m in msgs:
                                    if m.id == msg_id_final:
                                        tr_text = "".join(c.text for c in sorted(m.chunks, key=lambda c: c.chunk_idx)).strip() or tr_text
                                        break
                        except Exception:
                            pass
                        
                        # DEBUG: Check word timestamps configuration
                        word_timestamps_enabled = bool(getattr(self.room, "word_timestamps_enabled", True))
                        log.info(f"word_timestamps_enabled={word_timestamps_enabled}, tr_text='{tr_text}', audio_size={audio_arr.size if audio_arr is not None else 'None'}")
                        
                        if tr_text and word_timestamps_enabled and isinstance(audio_arr, np.ndarray) and audio_arr.size > 0:
                            try:
                                try:
                                    dur_ms = int(round((audio_arr.size / float(PCM_SR)) * 1000.0))
                                except Exception:
                                    dur_ms = 0
                                log.info(f"Starting FINAL alignment via model service (dur_ms={dur_ms}, text_len={len(tr_text)})")
                                # Prefer model service; fallback handled inside helper
                                tr = await align_via_model_service(audio_arr, PCM_SR, tr_text, stage="final")
                                tr_text = tr.text
                                words_payload = [{"start_ms": w.start_ms, "end_ms": w.end_ms, "text": w.text} for w in tr.words]
                                try:
                                    if getattr(tr, "words", None):
                                        # sample = ", ".join(f"{w.text}({w.start_ms}-{w.end_ms}ms)" for w in tr.words)
                                        log.info(f"Agent aligned {len(tr.words)} words")
                                    else:
                                        log.info("Alignment completed with 0 words.")
                                except Exception:
                                    pass
                            except Exception as e:
                                log.error(f"alignment failed: {e}")
                                log.warning("alignment failed: %s", e)
                        else:
                            log.info(f"Skipping alignment: tr_text_len={len(tr_text)}, audio_size={getattr(audio_arr, 'size', None)}, enabled={word_timestamps_enabled}")

                        # Broadcast transcript → include message_id so UI can attach it. Guard against duplicate emits for same rid.
                        try:
                            bc = getattr(self.room, "broadcast_transcript", None)
                            log.info(f"broadcast_transcript callable={callable(bc)}, word_timestamps_enabled={getattr(self.room, 'word_timestamps_enabled', True)}, words_count={len(words_payload)}")
                            if callable(bc) and getattr(self.room, "word_timestamps_enabled", True) and words_payload and (msg_id_final or "").strip():
                                # prevent duplicate broadcast for this response id if loop races
                                dupe_key = f"final_broadcast::{rid}"
                                if dupe_key in self._processed_done:
                                    log.info(f"Skipping duplicate final broadcast for rid={rid}")
                                else:
                                    self._processed_done.add(dupe_key)
                                log.info(f"Broadcasting transcript words={len(words_payload)} msg_id={msg_id_final} start_ts={start_ts} current_time={int(time.time() * 1000)}")
                                await bc(
                                    agent_id=self.id,
                                    message_id=msg_id_final,
                                    start_ts_ms=start_ts,
                                    words=words_payload,
                                    full_text=tr_text,
                                )
                                log.info(f"Successfully broadcast transcript")
                            else:
                                log.info(f"NOT broadcasting transcript: callable={callable(bc)}, enabled={getattr(self.room, 'word_timestamps_enabled', True)}, words={len(words_payload)}")
                        except Exception as e:
                            log.error(f"Failed to broadcast transcript: {e}")
                            pass

                        # cleanup
                        self._resp_audio.pop(rid, None)
                        self._resp_text.pop(rid, None)
                        self._resp_audio_start_ts_ms.pop(rid, None)
                        self._announced_output = False
                        self._processed_done.add(rid)
                        # Clear one-shot suppression at completion (finally)
                        self._suppress_next_tts = False

                    # ---- OPTIONAL EARLY/PARTIAL ALIGNMENT ----
                    elif evt_type in ("response.output_text.delta", "response.text.delta", "response.delta", "response.audio_transcript.delta"):
                        # If we have the first second of audio buffered and first non-empty text, emit partial transcript once
                        try:
                            rid = payload.get("response_id") or (payload.get("response") or {}).get("id") or "_default"
                            deltas = self._resp_text.get(rid, [])
                            joined_so_far = "".join(deltas).strip()
                            if (not joined_so_far):
                                # no meaningful text yet
                                pass
                            else:
                                audio_arr = self._resp_audio.get(rid) or self._resp_audio.get("_default")
                                if isinstance(audio_arr, np.ndarray) and audio_arr.size >= (SAMPLES_PER_CHUNK * 50) and bool(getattr(self.room, "word_timestamps_enabled", True)):
                                    # Only once per response id
                                    key = f"partial_done::{rid}"
                                    if key not in self._processed_done:
                                        self._processed_done.add(key)
                                        # take first ~1s (50 chunks @ 20ms)
                                        limit = SAMPLES_PER_CHUNK * 50
                                        first_sec = audio_arr[:limit]
                                        tr = await align_via_model_service(first_sec, PCM_SR, joined_so_far, stage="partial", num_chunks=50, chunk_ms=20)
                                        words_payload = [{"start_ms": w.start_ms, "end_ms": w.end_ms, "text": w.text} for w in tr.words]
                                        msg_id_for_partial: Optional[str] = self._rid_to_msg.get(rid) or self._current_msg_id
                                        if msg_id_for_partial is None:
                                            try:
                                                msg_id_for_partial = await self.publish_text_chunk(text="", message_id=None, chunk_idx=0, is_final=False)
                                                self._current_msg_id = msg_id_for_partial
                                            except Exception:
                                                msg_id_for_partial = None
                                        if msg_id_for_partial and words_payload:
                                            try:
                                                # Early transcript broadcast
                                                await self.room.broadcast_transcript(
                                                    agent_id=self.id,
                                                    message_id=msg_id_for_partial,
                                                    start_ts_ms=self._resp_audio_start_ts_ms.get(rid, int(time.time()*1000)),
                                                    words=words_payload,
                                                    full_text=tr.text or joined_so_far,
                                                )
                                            except Exception:
                                                pass
                        except Exception:
                            pass

            except Exception as ex:
                # Don't swallow errors silently; log them
                log.exception("openai realtime event loop error")


    async def _run(self) -> None:
        self._session = await self._start_session()
        try:
            self._session_ready.set()
        except Exception:
            pass
        self._tasks = [
            asyncio.create_task(self._pump_audio_in(self._session)),
            asyncio.create_task(self._pump_events(self._session)),
        ]
        try:
            await asyncio.wait(self._tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
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
            try:
                # Reset session ready flag on exit
                self._session_ready = asyncio.Event()
            except Exception:
                pass

    async def send_text(self, text: str, timeout: float = 2.0) -> None:
        """Send a text message directly to the realtime session, waiting briefly for readiness."""
        try:
            if self._session is None:
                try:
                    await asyncio.wait_for(self._session_ready.wait(), timeout)
                except Exception:
                    pass
            sess = self._session
            if sess is None:
                return
            await sess.send_message(text)
        except Exception:
            pass

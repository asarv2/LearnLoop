from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, Optional

import numpy as np

from ..bus import PCM_SR, AudioChunk
from ..transcripts import Transcript, Word, align_via_model_service


def _resample_linear(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out:
        return x.astype(np.float32)
    if x.size == 0:
        return np.zeros(0, dtype=np.float32)
    ratio = float(sr_out) / float(sr_in)
    n_out = max(1, int(round(x.size * ratio)))
    xi = np.arange(x.size, dtype=np.float32)
    idx = np.linspace(0, x.size - 1, num=n_out, dtype=np.float32)
    return np.interp(idx, xi, x).astype(np.float32)


class StreamingASRBackend:
    """Pluggable streaming ASR interface.

    Concrete implementation can use ufal/whisper_streaming or SimulStreaming.
    """

    def __init__(self, language: str = "auto", model_name: str = "large-v3", use_vad: bool = True, min_chunk_sec: float = 0.8) -> None:
        self.language = language
        self.model_name = model_name
        self.use_vad = use_vad
        self.min_chunk_sec = min_chunk_sec

    def reset(self) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def insert_audio_chunk(self, audio_f32_mono_16k: np.ndarray) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def process_iter(self) -> tuple[str, list[Word]]:  # returns (committed_text, words)
        raise NotImplementedError

    def finish(self) -> tuple[str, list[Word]]:
        raise NotImplementedError

    # Optional VAD edge APIs; backends that support VAD can override
    def pop_speech_started(self) -> bool:
        return False

    def pop_speech_stopped(self) -> bool:
        return False


class WhisperStreamingBackend(StreamingASRBackend):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._ok = False
        self._sio_client = None
        self._accumulated_text = ""
        self._finalized_words: list[Word] = []
        self._model_service_url = None
        self._connected = False
        # VAD event counters (edge-triggered consumption)
        self._speech_started_count = 0
        self._speech_stopped_count = 0
        
        try:
            import os

            import socketio

            # Get model service URL from environment
            self._model_service_url = os.getenv("MODEL_SERVICE_URL", "http://localhost:8001")
            # Create Socket.IO client
            self._sio_client = socketio.AsyncClient()
            self._ok = True
        except Exception as e:
            print(f"Failed to initialize whisper streaming backend: {e}")
            self._ok = False

    async def ensure_connected(self) -> bool:
        """Public helper to ensure connection; wraps private method for external callers."""
        try:
            return await self._ensure_sio_connection()
        except Exception:
            return False

    async def _ensure_sio_connection(self) -> bool:
        """Ensure Socket.IO connection to model service is established."""
        if not self._sio_client:
            return False
        if not self._connected:
            try:
                await self._sio_client.connect(self._model_service_url)
                
                # Set up event handlers
                @self._sio_client.event
                async def partial_result(data: Dict[str, Any]) -> None:
                    """Handle partial transcription results."""
                    # Could be used for real-time display
                    pass
                
                @self._sio_client.event
                async def final_result(data: Dict[str, Any]) -> None:
                    """Handle final transcription results."""
                    # Add to accumulated text and words
                    self._accumulated_text += data.get("text", "")
                    if data.get("words"):
                        for w in data["words"]:
                            self._finalized_words.append(Word(
                                text=w["word"],
                                start_ms=int(w["start"] * 1000),
                                end_ms=int(w["end"] * 1000)
                            ))

                # VAD start/stop events from model service
                @self._sio_client.event
                async def speech_started(data: Dict[str, Any]) -> None:
                    self._speech_started_count += 1

                @self._sio_client.event
                async def speech_stopped(data: Dict[str, Any]) -> None:
                    self._speech_stopped_count += 1
                
                self._connected = True
                return True
            except Exception as e:
                # Avoid log spam by only printing the first failure until we successfully connect
                if not getattr(self, "_logged_connect_error", False):
                    print(f"Failed to connect to model service: {e}")
                    self._logged_connect_error = True
                return False
        return self._connected

    def reset(self) -> None:
        if self._ok:
            try:
                # Reset accumulated state
                self._accumulated_text = ""
                self._finalized_words.clear()
                self._speech_started_count = 0
                self._speech_stopped_count = 0
                # Disconnect Socket.IO client
                if self._connected and self._sio_client:
                    asyncio.create_task(self._sio_client.disconnect())
                    self._connected = False
            except Exception:
                pass

    def insert_audio_chunk(self, audio_f32_mono_16k: np.ndarray) -> None:
        if not self._ok:
            return
        try:
            # Convert float32 to int16 PCM
            pcm16 = (np.clip(audio_f32_mono_16k, -1.0, 1.0) * 32767.0).astype(np.int16)
            # Send audio data via WebSocket (async operation)
            asyncio.create_task(self._send_audio_async(pcm16.tobytes()))
        except Exception:
            pass

    async def _send_audio_async(self, pcm16_bytes: bytes) -> None:
        """Send audio data to model service via Socket.IO."""
        try:
            ok = await self._ensure_sio_connection()
            if ok and self._sio_client:
                await self._sio_client.emit("audio_data", pcm16_bytes)
        except Exception:
            # Connection failed, reset it
            self._connected = False

    def process_iter(self) -> tuple[str, list[Word]]:
        if not self._ok:
            return "", []
        try:
            # With Socket.IO, results come via events, so just return current state
            return self._accumulated_text, self._finalized_words[-10:]  # Return recent words
        except Exception:
            return "", []

    def finish(self) -> tuple[str, list[Word]]:
        if not self._ok:
            return "", []
        try:
            # With Socket.IO, final results come via events
            # Disconnect after finishing
            if self._connected and self._sio_client:
                asyncio.create_task(self._sio_client.disconnect())
                self._connected = False
            return self._accumulated_text, self._finalized_words
        except Exception:
            return "", []

    # ---- VAD event consumption API ----
    def pop_speech_started(self) -> bool:
        if self._speech_started_count > 0:
            self._speech_started_count -= 1
            return True
        return False

    def pop_speech_stopped(self) -> bool:
        if self._speech_stopped_count > 0:
            self._speech_stopped_count -= 1
            return True
        return False


@dataclass
class _PerSourceState:
    source_id: str
    is_agent: bool
    started: bool = False
    start_ts_ms: int = 0
    last_active_ts: float = 0.0
    audio_buf: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=np.float32))
    # streaming state
    backend: Optional[StreamingASRBackend] = None
    partial_text: str = ""
    partial_chunk_idx: int = 0
    # message mapping and final text
    message_id: Optional[str] = None
    final_text_accum: list[str] = field(default_factory=list)
    # progressive transcript emission
    cumulative_words: list[Dict[str, Any]] = field(default_factory=list)
    last_emit_ms: float = 0.0
    last_words_len: int = 0


class TimestampListenerManager:
    def __init__(
        self,
        *,
        room: Any,
        streaming_enabled_for_agents: bool = True,
        streaming_enabled_for_users: bool = True,
        language: str = "auto",
    ) -> None:
        self._room = room
        self._stream_agents = bool(streaming_enabled_for_agents)
        self._stream_users = bool(streaming_enabled_for_users)
        self._language = language
        self._states: Dict[str, _PerSourceState] = {}
        # thresholds
        self._active_rms = 1.2e-4
        self._end_quiet_sec_agent = 0.15
        self._end_quiet_sec_user = 0.35

    def _get_state(self, source_id: str) -> _PerSourceState:
        st = self._states.get(source_id)
        if st is None:
            is_agent = source_id.startswith("agent:")
            st = _PerSourceState(
                source_id=source_id,
                is_agent=is_agent,
                # Backend is created fresh per turn to avoid stale connections
                backend=None,
            )
            self._states[source_id] = st
        return st

    async def on_text_chunk(self, payload: Dict[str, Any]) -> None:
        try:
            source_id = str(payload.get("source_id") or payload.get("agent_id") or "")
            if not source_id:
                return
            st = self._get_state(source_id)
            txt = str(payload.get("text") or "")
            # remember latest message_id
            mid = payload.get("message_id") or payload.get("id")
            if isinstance(mid, str) and mid:
                st.message_id = mid
            # accumulate final text candidate
            if txt:
                st.final_text_accum.append(txt)
        except Exception:
            pass

    async def on_chunk(self, chunk: AudioChunk) -> None:
        try:
            st = self._get_state(chunk.source_id)
            # Ignore beep source entirely for transcripts
            if st.source_id == "agent:beep":
                return
            now = time.time()
            rms = float(chunk.meta.get("rms", 0.0))

            # If an agent just became active (audio arrived), immediately finalize any in-flight user message
            if st.is_agent and rms >= self._active_rms:
                try:
                    for other_id, other in list(self._states.items()):
                        if (not other.is_agent) and other.started and other.message_id:
                            await self._finalize(other)
                except Exception:
                    pass
            # NOTE: Do not use backend VAD edges to drive lifecycle anymore. Bus RMS + agent starts/stops control turns.
            # start session (bus-based)
            if (not st.started) and rms >= self._active_rms:
                # If an old user message is still open (edge case), finalize it before starting a new turn
                if (not st.is_agent) and st.message_id:
                    try:
                        await self._room.append_text_chunk(
                            source_id=st.source_id,
                            role="user",
                            text="",
                            message_id=st.message_id,
                            chunk_idx=9999,
                            is_final=True,
                        )
                    except Exception:
                        pass
                    st.message_id = None
                st.started = True
                st.start_ts_ms = int(now * 1000)
                st.last_active_ts = now
                st.audio_buf = np.zeros(0, dtype=np.float32)
                # Create a fresh streaming backend per turn and connect (for users/agents as configured)
                try:
                    if ((self._stream_agents and st.is_agent) or (self._stream_users and (not st.is_agent))):
                        st.backend = WhisperStreamingBackend(language=self._language)
                        # best-effort connect; audio path will also try
                        try:
                            # ensure connection at turn start for stability
                            loop = asyncio.get_running_loop()
                            # run ensure_connected without blocking this path if needed
                            loop.create_task(st.backend.ensure_connected())  # type: ignore[attr-defined]
                        except Exception:
                            pass
                        st.partial_text = ""
                        st.partial_chunk_idx = 0
                except Exception:
                    pass
            # if not started, ignore until speech begins
            if not st.started:
                return
            # append audio
            st.audio_buf = np.concatenate([st.audio_buf, chunk.data.astype(np.float32)])
            # streaming path if enabled for this speaker kind
            do_stream = (st.is_agent and self._stream_agents) or ((not st.is_agent) and self._stream_users)
            if do_stream and st.backend is not None:
                try:
                    x16 = _resample_linear(chunk.data, PCM_SR, 16000)
                    st.backend.insert_audio_chunk(x16)
                    txt, words = st.backend.process_iter()
                    if txt:
                        # Skip streaming transcripts for beep (safety)
                        if st.source_id == "agent:beep":
                            return
                        # If this is USER speech, stream as text chunks (create/append a user turn)
                        if not st.is_agent:
                            try:
                                # Compute delta since last partial
                                if len(txt) > len(st.partial_text):
                                    delta = txt[len(st.partial_text):]
                                    if delta.strip():
                                        # Create message on first non-empty delta; else append
                                        if not st.message_id:
                                            st.message_id = await self._room.append_text_chunk(
                                                source_id=st.source_id,
                                                role="user",
                                                text=delta,
                                                message_id=None,
                                                chunk_idx=0,
                                                is_final=False,
                                            )
                                            st.partial_chunk_idx = 1
                                        else:
                                            await self._room.append_text_chunk(
                                                source_id=st.source_id,
                                                role="user",
                                                text=delta,
                                                message_id=st.message_id,
                                                chunk_idx=st.partial_chunk_idx,
                                                is_final=False,
                                            )
                                            st.partial_chunk_idx += 1
                                    st.partial_text = txt
                            except Exception:
                                pass
                        else:
                            # Agent: build cumulative, time-based word list across full partial text
                            dur_ms = int(round((st.audio_buf.size / PCM_SR) * 1000.0))
                            tokens = [w.text for w in words] if words else txt.split()
                            n = max(1, len(tokens))
                            per = max(1, dur_ms // n)
                            # IMPORTANT: Emit word times RELATIVE to utterance start.
                            # The client uses start_ts_ms separately and expects word times to be relative.
                            st.cumulative_words = [
                                {
                                    "start_ms": i * per,
                                    "end_ms": (dur_ms if i == n - 1 else (i + 1) * per),
                                    "text": tokens[i],
                                }
                                for i in range(n)
                            ]
                            now_ms = now * 1000.0
                            grew = len(st.cumulative_words) > st.last_words_len
                            if grew and (now_ms - st.last_emit_ms) >= 120.0:
                                st.last_emit_ms = now_ms
                                st.last_words_len = len(st.cumulative_words)
                                await self._room.broadcast_transcript(
                                    agent_id=st.source_id,
                                    message_id=st.message_id,
                                    start_ts_ms=st.start_ts_ms,
                                    words=st.cumulative_words,
                                    full_text=txt,
                                )
                except Exception:
                    pass
            # activity tracking
            if rms >= self._active_rms:
                st.last_active_ts = now
            else:
                quiet = now - st.last_active_ts
                end_after = self._end_quiet_sec_agent if st.is_agent else self._end_quiet_sec_user
                if quiet >= end_after:
                    await self._finalize(st)
        except Exception:
            pass

    async def _finalize(self, st: _PerSourceState) -> None:
        try:
            # Skip beep on finalize as well
            if st.source_id == "agent:beep":
                st.started = False
                st.audio_buf = np.zeros(0, dtype=np.float32)
                st.final_text_accum.clear()
                st.message_id = None
                return
            audio = st.audio_buf.astype(np.float32)
            st.started = False
            st.audio_buf = np.zeros(0, dtype=np.float32)
            final_text = " ".join([t for t in st.final_text_accum if t]).strip()
            st.final_text_accum.clear()
            st.last_emit_ms = 0.0
            st.last_words_len = 0
            # Explicitly finish and disconnect streaming backend so Whisper doesn't continue post-utterance
            try:
                if st.backend is not None:
                    _ = st.backend.finish()
                    # drop the backend instance after finishing to force fresh init next turn
                    st.backend = None
            except Exception:
                pass
            if (st.is_agent and self._stream_agents) or ((not st.is_agent) and self._stream_users):
                # We already streamed partials; still realign for higher quality if we have text
                pass
            # If we have some text, run CTC realignment; else skip
            if final_text:
                tr: Transcript = await align_via_model_service(audio, PCM_SR, final_text, stage="final")
                # IMPORTANT: Keep word times RELATIVE; client combines with start_ts_ms.
                words = [
                    {"start_ms": int(w.start_ms), "end_ms": int(w.end_ms), "text": w.text}
                    for w in tr.words
                ]
                if st.is_agent:
                    await self._room.broadcast_transcript(
                        agent_id=st.source_id,
                        message_id=st.message_id,
                        start_ts_ms=st.start_ts_ms,
                        words=words,
                        full_text=tr.text or final_text,
                    )
                else:
                    # Emit final, aligned user transcript for persistence and UI, then finalize the text message
                    try:
                        await self._room.broadcast_transcript(
                            agent_id=st.source_id,
                            message_id=st.message_id,
                            start_ts_ms=st.start_ts_ms,
                            words=words,
                            full_text=tr.text or final_text,
                        )
                    except Exception:
                        pass
                    try:
                        if st.message_id:
                            await self._room.append_text_chunk(
                                source_id=st.source_id,
                                role="user",
                                text="",
                                message_id=st.message_id,
                                chunk_idx=9999,
                                is_final=True,
                            )
                    except Exception:
                        pass
            # notify stop to clamp UI if we had a message id
            try:
                if getattr(self._room, "on_transcript_stop", None) and st.message_id:
                    payload = {
                        "room_id": getattr(self._room, "id", ""),
                        "agent_id": st.source_id,
                        "message_id": st.message_id,
                        "stop_ts_ms": int(time.time() * 1000),
                    }
                    await self._room.on_transcript_stop(payload)  # type: ignore[func-returns-value]
            except Exception:
                pass
            # clear mapping for next utterance
            st.message_id = None
        except Exception:
            pass



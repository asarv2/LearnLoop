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


class WhisperStreamingBackend(StreamingASRBackend):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._ok = False
        self._sio_client = None
        self._accumulated_text = ""
        self._finalized_words = []
        self._model_service_url = None
        self._connected = False
        
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

    async def _ensure_sio_connection(self) -> bool:
        """Ensure Socket.IO connection to model service is established."""
        if not self._connected and self._sio_client:
            try:
                await self._sio_client.connect(self._model_service_url)
                self._connected = True
                return True
            except Exception as e:
                print(f"Failed to connect to model service: {e}")
                return False
        return self._connected

    def reset(self) -> None:
        if self._ok:
            try:
                # Reset accumulated state
                self._accumulated_text = ""
                self._finalized_words = []
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
        """Send audio data to model service via WebSocket."""
        try:
            if await self._ensure_ws_connection():
                await self._ws_connection.send(pcm16_bytes)
        except Exception:
            # Connection failed, reset it
            self._ws_connection = None

    def process_iter(self) -> tuple[str, list[Word]]:
        if not self._ok:
            return "", []
        try:
            # Poll for new results (async operation)
            asyncio.create_task(self._poll_results_async())
            return self._accumulated_text, self._finalized_words[-10:]  # Return recent words
        except Exception:
            return "", []

    async def _poll_results_async(self) -> None:
        """Poll for transcription results from model service."""
        try:
            if await self._ensure_ws_connection():
                # Check for messages (non-blocking)
                try:
                    message = await asyncio.wait_for(self._ws_connection.recv(), timeout=0.01)
                    import json
                    data = json.loads(message)
                    
                    if data.get("type") == "partial":
                        # Update partial text (could be used for real-time display)
                        pass
                    elif data.get("type") == "final":
                        # Add to accumulated text and words
                        self._accumulated_text += data.get("text", "")
                        if data.get("words"):
                            for w in data["words"]:
                                self._finalized_words.append(Word(
                                    text=w["word"],
                                    start_ms=int(w["start"] * 1000),
                                    end_ms=int(w["end"] * 1000)
                                ))
                except asyncio.TimeoutError:
                    # No message available, that's fine
                    pass
        except Exception:
            # Connection failed, reset it
            self._ws_connection = None

    def finish(self) -> tuple[str, list[Word]]:
        if not self._ok:
            return "", []
        try:
            # Final poll for any remaining results
            asyncio.create_task(self._final_poll_async())
            return self._accumulated_text, self._finalized_words
        except Exception:
            return "", []

    async def _final_poll_async(self) -> None:
        """Final poll to get any remaining transcription results."""
        try:
            if await self._ensure_ws_connection():
                # Wait a bit longer for final results
                try:
                    while True:
                        message = await asyncio.wait_for(self._ws_connection.recv(), timeout=0.1)
                        import json
                        data = json.loads(message)
                        
                        if data.get("type") == "final":
                            self._accumulated_text += data.get("text", "")
                            if data.get("words"):
                                for w in data["words"]:
                                    self._finalized_words.append(Word(
                                        text=w["word"],
                                        start_ms=int(w["start"] * 1000),
                                        end_ms=int(w["end"] * 1000)
                                    ))
                except asyncio.TimeoutError:
                    # No more messages
                    pass
                finally:
                    # Close connection
                    await self._ws_connection.close()
                    self._ws_connection = None
        except Exception:
            self._ws_connection = None


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
    # message mapping and final text
    message_id: Optional[str] = None
    final_text_accum: list[str] = field(default_factory=list)


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
                backend=(WhisperStreamingBackend(language=self._language) if ((self._stream_agents and is_agent) or (self._stream_users and (not is_agent))) else None),
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
            now = time.time()
            rms = float(chunk.meta.get("rms", 0.0))
            # start session
            if (not st.started) and rms >= self._active_rms:
                st.started = True
                st.start_ts_ms = int(now * 1000)
                st.last_active_ts = now
                st.audio_buf = np.zeros(0, dtype=np.float32)
                if st.backend:
                    try:
                        st.backend.reset()
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
                        # naive timing: spread words across observed duration so far (placeholder before CTC)
                        dur_ms = int(round((st.audio_buf.size / PCM_SR) * 1000.0))
                        tokens = [w.text for w in words] if words else txt.split()
                        n = max(1, len(tokens))
                        per = max(1, dur_ms // n)
                        out_words = [
                            {
                                "start_ms": st.start_ts_ms + i * per,
                                "end_ms": st.start_ts_ms + (dur_ms if i == n - 1 else (i + 1) * per),
                                "text": tokens[i],
                            }
                            for i in range(n)
                        ]
                        await self._room.broadcast_transcript(
                            agent_id=st.source_id,
                            message_id=st.message_id,
                            start_ts_ms=st.start_ts_ms,
                            words=out_words,
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
            audio = st.audio_buf.astype(np.float32)
            st.started = False
            st.audio_buf = np.zeros(0, dtype=np.float32)
            final_text = " ".join([t for t in st.final_text_accum if t]).strip()
            st.final_text_accum.clear()
            if (st.is_agent and self._stream_agents) or ((not st.is_agent) and self._stream_users):
                # We already streamed partials; still realign for higher quality if we have text
                pass
            # If we have some text, run CTC realignment; else skip
            if final_text:
                tr: Transcript = await align_via_model_service(audio, PCM_SR, final_text, stage="final")
                words = [
                    {"start_ms": st.start_ts_ms + int(w.start_ms), "end_ms": st.start_ts_ms + int(w.end_ms), "text": w.text}
                    for w in tr.words
                ]
                await self._room.broadcast_transcript(
                    agent_id=st.source_id,
                    message_id=st.message_id,
                    start_ts_ms=st.start_ts_ms,
                    words=words,
                    full_text=tr.text or final_text,
                )
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



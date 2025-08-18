# server/app/main.py
import asyncio
import base64
import contextlib
import fractions
import json
import logging
import os
import platform
import sys
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

import socketio  # type: ignore
from agents.realtime import RealtimeModelSendEvent, RealtimeSession
from aiortc import (MediaStreamTrack, RTCConfiguration,  # type: ignore
                    RTCIceCandidate, RTCIceServer, RTCPeerConnection,
                    RTCSessionDescription)
from aiortc.sdp import candidate_from_sdp  # type: ignore
from av import AudioFrame, AudioResampler  # type: ignore
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from websockets.exceptions import ConnectionClosedOK  # type: ignore

load_dotenv()

import os

from litellm.litellm_core_utils import litellm_logging as LL

LL.get_standard_logging_object_payload = lambda *a, **k: None

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

origin = os.getenv("ORIGIN", "http://localhost:3000")

# ---------------------------------------------------------------------------+
# 2.  CORS etc. remains intact                                               +
# ---------------------------------------------------------------------------+
# Allow all origins
allowed_origins = [origin]

# Import Redis functions from extensions
from app.extensions import (cleanup_redis_client, find_profile_by_socket,
                            get_socket_owner, init_redis_client,
                            remove_socket_owner, set_socket_owner)

# Store active chat connections
active_connections: dict[str, str] = {}

# Global store for all active runs (unified tracking)
active_runs: dict[str, Any] = {}

# Profile-based connection management (simplified)
profiles_live: Dict[str, RTCPeerConnection] = {}  # profile_id -> RTCPeerConnection

# ICE candidate buffering for profiles without remote description
pending_ice: Dict[str, List[RTCIceCandidate]] = defaultdict(list)

# WebRTC configuration flag
WEBRTC_ENABLED = True

class ServerAudioStreamTrack(MediaStreamTrack):
    """
    Receives pre-chunked 20ms, 48kHz PCM audio and wraps it in a timed AudioFrame.
    """
    kind = "audio"

    def __init__(self) -> None:
        super().__init__()
        self.queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue()
        self._pts = 0
        self._time_base = fractions.Fraction(1, 48000)

    def add_chunk(self, chunk: bytes) -> None:
        """Adds audio chunk(s) to the queue, automatically splitting oversized buffers."""
        frame_size = 960 * 2  # 960 samples × 2 bytes = 1920 bytes per 20ms frame
        
        # Fast path: correctly sized chunk
        if len(chunk) == frame_size:
            self.queue.put_nowait(chunk)
            return
        
        # Handle oversized buffers by splitting them into proper frames
        if len(chunk) > frame_size:
            # Warn about non-multiple remainders that will be truncated
            if len(chunk) % frame_size != 0:
                logger.warning(f"Non-multiple buffer {len(chunk)} bytes – truncating remainder")
            
            # Split into 1920-byte frames
            for i in range(0, len(chunk) - (len(chunk) % frame_size), frame_size):
                self.queue.put_nowait(chunk[i:i + frame_size])
            return
        
        # Handle undersized chunks (shouldn't happen but just in case)
        logger.warning(f"Undersized chunk {len(chunk)} bytes – padding to frame size")
        padded_chunk = chunk + b'\x00' * (frame_size - len(chunk))
        self.queue.put_nowait(padded_chunk)

    def clear(self) -> None:
        """Empties the audio queue to handle interruptions."""
        while not self.queue.empty():
            try:
                self.queue.get_nowait()
            except asyncio.QueueEmpty:
                # This can happen in a race condition, it's safe to ignore.
                break
        logger.info("Outbound audio queue cleared due to interruption.")

    def end_stream(self) -> None:
        """Signals the end of the stream by adding a None sentinel."""
        logger.info("Ending persistent server audio stream.")
        self.queue.put_nowait(None)

    # ✨ THIS IS THE CORRECT, SIMPLIFIED RECV METHOD
    async def recv(self) -> AudioFrame:
        """Pulls a pre-formatted s16 mono chunk and wraps it in a timed AudioFrame."""
        # Try to keep a steady 20ms cadence; if producer stalls, synthesize silence
        try:
            chunk = await asyncio.wait_for(self.queue.get(), timeout=0.02)
        except asyncio.TimeoutError:
            # Underflow: insert a 20ms silence frame to avoid choppy playback
            chunk = b"\x00" * (960 * 2)
        if chunk is None:
            self.stop()
            raise asyncio.CancelledError("Audio stream ended.")

        # The chunk from the queue is now guaranteed to be clean s16 mono audio.
        # No conversion is needed here.
        frame = AudioFrame(format="s16", layout="mono", samples=960)
        frame.planes[0].update(chunk)

        # Set the presentation timestamp for smooth playback
        frame.sample_rate = 48000
        frame.pts = self._pts
        frame.time_base = self._time_base
        self._pts += frame.samples
        
        # This pacing is critical to prevent choppy audio
        await asyncio.sleep(frame.samples / 48000)  # 20ms pacing
        
        return frame

# Add this helper function to the top of the file
def force_opus_codec(sdp: str) -> str:
    """Manipulates the SDP to prioritize the Opus codec."""
    sdp_lines = sdp.splitlines()
    opus_payload_type = None
    
    # Find the payload type for Opus
    for line in sdp_lines:
        if "rtpmap" in line and "opus/48000" in line:
            try:
                # Example: a=rtpmap:96 opus/48000/2
                opus_payload_type = line.split(":")[1].split(" ")[0]
                break
            except IndexError:
                continue
                
    if opus_payload_type:
        logger.info(f"Found Opus codec with payload type: {opus_payload_type}")
        new_sdp_lines = []
        for line in sdp_lines:
            # Rebuild the m=audio line to only include Opus
            if line.startswith("m=audio"):
                parts = line.split(" ")
                # Example becomes: m=audio 9 UDP/TLS/RTP/SAVPF 96
                new_line = " ".join(parts[:3] + [opus_payload_type])
                new_sdp_lines.append(new_line)
                logger.info(f"Rewriting m=audio line to: {new_line}")
            else:
                new_sdp_lines.append(line)
        return "\r\n".join(new_sdp_lines)

    logger.warning("Opus codec not found in offer, cannot force it.")
    return sdp

# ---------------------------------------------------------------------------+
# 4.  Empty ICE list when disabled                                           +
# ---------------------------------------------------------------------------+
def _build_server_ice() -> List[Dict[str, Any]]:
    turn_uri = os.getenv("TURN_URI_INTERNAL") or os.getenv("TURN_URI") or ""
    stun_uri = os.getenv("STUN_URI_INTERNAL") or os.getenv("STUN_URI") or ""
    user = os.getenv("TURN_USERNAME"); pwd = os.getenv("TURN_PASSWORD")
    if not (turn_uri and stun_uri):
        raise ValueError("Missing TURN/STUN envs for server ICE")
    stun_uris = [u.strip() for u in stun_uri.split(",")]
    turn_uris = [u.strip() for u in turn_uri.split(",")]
    if user and pwd:
        return [{"urls": stun_uris + turn_uris, "username": user, "credential": pwd}]
    return [{"urls": stun_uris}]

def _build_client_ice() -> List[Dict[str, Any]]:
    turn_uri = os.getenv("TURN_URI_PUBLIC") or os.getenv("TURN_URI") or ""
    stun_uri = os.getenv("STUN_URI_PUBLIC") or os.getenv("STUN_URI") or ""
    user = os.getenv("TURN_USERNAME"); pwd = os.getenv("TURN_PASSWORD")
    if not (turn_uri and stun_uri):
        raise ValueError("Missing TURN/STUN envs for client ICE")
    stun_uris = [u.strip() for u in stun_uri.split(",")]
    turn_uris = [u.strip() for u in turn_uri.split(",")]
    if user and pwd:
        return [{"urls": stun_uris + turn_uris, "username": user, "credential": pwd}]
    return [{"urls": stun_uris}]

async def cleanup_profile_connection(profile_id: str, reason: str = "cleanup") -> None:
    """Clean up all connections for a profile."""
    logger.info(f"Cleaning up profile {profile_id} connections - {reason}")
    
    # Remove from socket ownership
    await remove_socket_owner(profile_id)
    
    # Clear any buffered ICE candidates
    pending_ice.pop(profile_id, None)
    
    # Close and remove peer connection
    pc = profiles_live.pop(profile_id, None)
    if pc and pc.connectionState != "closed":
        try:
            # Cancel any running echo task
            if hasattr(pc, "_echo_task") and not pc._echo_task.done():
                pc._echo_task.cancel()
                logger.info(f"Cancelled echo task for profile {profile_id}")
            
            # Give a moment for tasks to wrap up before closing
            await asyncio.sleep(0.1)  # Small delay to prevent race conditions
            await pc.close()
            logger.info(f"Closed peer connection for profile {profile_id}")
        except Exception as e:
            logger.error(f"Error closing peer connection for profile {profile_id}: {e}")
    
    # Update database to mark profile as inactive
    try:
        from app.db import get_session
        from app.models import Profiles
        
        db_session = next(get_session())
        try:
            profile = db_session.exec(
                select(Profiles).where(Profiles.id == profile_id)
            ).one_or_none()
            
            if profile:
                profile.active = False
                profile.last_active = datetime.now(timezone.utc)
                db_session.add(profile)
                db_session.commit()
                logger.info(f"Updated profile {profile_id} to inactive in database")
        finally:
            db_session.close()
    except Exception as e:
        logger.error(f"Error updating profile {profile_id} in database: {e}")

async def get_pc(profile_id: str) -> RTCPeerConnection:
    """Return existing pc or create a fresh one after closing the old."""
    pc_old = profiles_live.pop(profile_id, None)
    if pc_old:
        # Cancel any running echo task before closing
        if hasattr(pc_old, "_echo_task") and not pc_old._echo_task.done():
            pc_old._echo_task.cancel()
        await pc_old.close()

    # Convert our dict format to aiortc's RTCIceServer objects
    ice_servers_list = []
    for s in _build_server_ice():
        if "username" in s:
            ice_servers_list.append(RTCIceServer(urls=s["urls"], username=s["username"], credential=s["credential"]))
        else:
            ice_servers_list.append(RTCIceServer(urls=s["urls"]))
    config = RTCConfiguration(iceServers=ice_servers_list)
    pc = RTCPeerConnection(configuration=config)
    
    # SPEC CHANGE: Create and store a persistent audio track upfront
    server_audio_track = ServerAudioStreamTrack()
    
    # NEW - Creates one simple, bi-directional audio channel
    pc.addTrack(server_audio_track)
    
    logger.info(f"WebRTC peer connection setup complete for profile {profile_id}: 1 sendrecv audio track")

    # ---- ensure at least one negotiated data channel so the initial SDP has an m-section ----
    signalling_dc = pc.createDataChannel("signalling")  # name arbitrary but consistent

    @signalling_dc.on("open")  # type: ignore
    def _() -> None:
        logger.info(f"Signalling data channel open for profile {profile_id}")
    
    # NEW: Create persistent text data channel for high-frequency token streaming
    text_dc = pc.createDataChannel("text", ordered=True)  # ordered, reliable
    
    @text_dc.on("open")  # type: ignore
    def _() -> None:
        logger.info(f"Text data-channel open for profile {profile_id}")
    
    @text_dc.on("close")  # type: ignore
    def _() -> None:
        logger.info(f"Text data-channel closed for profile {profile_id}")
    
    @text_dc.on("error")  # type: ignore
    def on_error(error: Any) -> None:
        logger.error(f"Text data-channel error for profile {profile_id}: {error}")
    
    @text_dc.on("message")  # type: ignore
    def on_message(message: Any) -> None:
        # Handle incoming text data channel messages (user messages)
        asyncio.create_task(handle_text_dc_message(profile_id, message))
    
    # Store the text channel reference for sending messages
    setattr(pc, "_text_channel", text_dc)
    
    # Set up peer connection event handlers
    @pc.on("connectionstatechange")  # type: ignore
    async def on_connectionstatechange() -> None:
        logger.info(f"WebRTC connection state changed to {pc.connectionState} for profile {profile_id}")
        
        # Get current socket owner for this profile
        current_socket_owner = await get_socket_owner(profile_id)
        if current_socket_owner:
            await sio.emit('webrtc_connection_state', {
                'profile_id': profile_id,
                'state': pc.connectionState
            }, room=current_socket_owner)
            
            if pc.connectionState == "failed" or pc.connectionState == "closed":
                # Clean up on failure/closure
                await cleanup_profile_connection(profile_id, f"connection state {pc.connectionState}")
    
    @pc.on("iceconnectionstatechange")  # type: ignore
    async def on_iceconnectionstatechange() -> None:
        logger.info(f"WebRTC ICE connection state changed to {pc.iceConnectionState} for profile {profile_id}")
        
        # Get current socket owner for this profile
        current_socket_owner = await get_socket_owner(profile_id)
        if current_socket_owner:
            await sio.emit('webrtc_ice_state', {
                'profile_id': profile_id,
                'state': pc.iceConnectionState
            }, room=current_socket_owner)
    
    @pc.on("icecandidate")  # type: ignore
    async def on_icecandidate(candidate: RTCIceCandidate | None) -> None:
        # Get current socket owner for this profile
        current_socket_owner = await get_socket_owner(profile_id)
        if current_socket_owner:
            await sio.emit(
                "webrtc_ice_candidate",
                {
                    "profile_id": profile_id,
                    "candidate": {
                        "candidate": str(candidate),
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                    } if candidate else None,      # <-- None when gathering is done
                },
                room=current_socket_owner,
            )
            
    # ✨ REALTIME VOICE AGENT BRIDGE
    # ✨ REALTIME VOICE AGENT BRIDGE
    async def realtime_voice_bridge_task(in_track: MediaStreamTrack, out_track: ServerAudioStreamTrack) -> None:
        """
        Manages the voice conversation by creating a new RealtimeSession for each user turn.
        """
        # Lazy imports to avoid circulars
        from app.db import get_session
        from app.models import Chats, Messages, Personas
        from app.services.agents.voice.realtime import \
            create_realtime_voice_session
        from app.web.training import get_persona_id_from_chat

        # Prime outbound audio with ~400ms of silence to move clients off HAVE_NOTHING
        try:
            silence_chunk = b"\x00" * (960 * 2)  # 20ms @ 48kHz mono s16 = 1920 bytes
            for _ in range(20):  # ~400ms
                out_track.add_chunk(silence_chunk)
            logger.info("Primed outbound audio with initial silence frames.")
        except Exception as e:
            logger.warning(f"Failed to prime silence frames: {e}")

        # Resamplers (reused across turns)
        in_to_model_resampler = AudioResampler(format="s16", layout="mono", rate=24000)
        model_to_out_resampler = AudioResampler(format="s16", layout="mono", rate=48000)

        # Helper: emit over data-channel else websocket
        async def emit_transport(payload: dict[str, Any], chat_id_for_voice: str) -> None:
            payload_with_chat: dict[str, Any] = {**payload, "chat_id": chat_id_for_voice}
            sent = await send_text_dc(profile_id, payload_with_chat)
            if not sent:
                await sio.emit("transport_event", payload_with_chat, room=profile_id)

        # This outer loop runs for the entire duration of the voice call
        while True:
            session = None
            db_session = None
            try:
                # Wait for the first audio frame from the user to start a new turn
                logger.info("Voice Bridge: Waiting for user to speak...")
                first_frame = await in_track.recv()
                logger.info("Voice Bridge: User started speaking, creating new session.")

                # ✨ YOUR FIX GOES HERE!
                # When the user speaks, it's an implicit interruption.
                # Clear any audio the server was in the middle of sending.
                out_track.clear()

                # -- SETUP A NEW SESSION FOR THIS TURN --
                db_session = next(get_session())
                chat_id_for_voice = getattr(pc, "_last_chat_id", None)
                if not chat_id_for_voice:
                    logger.warning("No chat_id associated with PC.")
                    continue  # Wait for the next turn

                # Ensure chat_id_for_voice is a string
                chat_id_for_voice = str(chat_id_for_voice)

                chat_obj = db_session.exec(select(Chats).where(Chats.id == chat_id_for_voice)).one_or_none()
                if not chat_obj:
                    logger.error(f"Chat {chat_id_for_voice} not found in DB.")
                    continue

                persona_id = get_persona_id_from_chat(
                    db_session, 
                    str(chat_obj.id), 
                    [str(pid) for pid in (chat_obj.parameter_ids or [])]
                )
                if not persona_id:
                    logger.error(f"Could not find persona for chat {chat_id_for_voice}.")
                    continue

                session = await create_realtime_voice_session(chat_id_for_voice, persona_id, db_session)
                setattr(pc, "_realtime_session", session)

                # -- DEFINE TASKS FOR THIS SPECIFIC TURN --
                shutdown_flag = asyncio.Event()
                
                async def pump_incoming_audio_turn() -> None:
                    if not session:
                        return
                    try:
                        # Immediately process the first frame we already received
                        for frame in in_to_model_resampler.resample(first_frame):
                            await session.send_audio(frame.to_ndarray()[0].tobytes(), commit=False)
                        
                        # Continue pumping subsequent frames
                        while not shutdown_flag.is_set():
                            in_frame = await in_track.recv()
                            if shutdown_flag.is_set():
                                break
                            for frame in in_to_model_resampler.resample(in_frame):
                                await session.send_audio(frame.to_ndarray()[0].tobytes(), commit=False)
                            await asyncio.sleep(0.01)
                    except ConnectionClosedOK:
                        logger.info("Audio pump: Connection closed during turn.")
                    except Exception as e:
                        logger.error(f"Error in pump_incoming_audio_turn: {e}", exc_info=True)
                    finally:
                        logger.info("Audio pump for turn has finished.")

                async def consume_session_events_turn() -> None:
                    if not session or not db_session:
                        return
                    
                    # Capture chat_id_for_voice from outer scope - ensure it's a string
                    current_chat_id: str = str(chat_id_for_voice) if chat_id_for_voice else ""
                    if not current_chat_id:
                        logger.error("No chat_id available for consume_session_events_turn")
                        return
                    
                    assistant_message_id: Optional[Any] = None
                    accumulated_assistant: str = ""
                    user_turn_start_time: Optional[datetime] = None
                    audio_buffer = b""
                    REQUIRED_FRAME_SIZE = 1920  # 960 samples * 2 bytes/sample for 48kHz s16 mono

                    try:
                        async for event in session:
                            if shutdown_flag.is_set():
                                break
                            
                            if event.type == "audio":
                                audio_data = event.audio.data
                                if not audio_data:
                                    logger.warning("Received 'audio' event but it was empty!")
                                    continue

                                try:
                                    # Create a frame from the raw 24kHz model audio
                                    model_frame = AudioFrame(format="s16", layout="mono", samples=len(event.audio.data) // 2)
                                    model_frame.planes[0].update(event.audio.data)
                                    model_frame.sample_rate = 24000
                                    
                                    # Resample to 48kHz for WebRTC output
                                    for out_frame in model_to_out_resampler.resample(model_frame):
                                        # Append the resampled audio bytes to our buffer
                                        audio_buffer += out_frame.to_ndarray()[0].tobytes()

                                        # Process the buffer and send complete 1920-byte frames
                                        while len(audio_buffer) >= REQUIRED_FRAME_SIZE:
                                            # Extract one complete frame
                                            frame_to_send = audio_buffer[:REQUIRED_FRAME_SIZE]
                                            
                                            # Send it to the client
                                            out_track.add_chunk(frame_to_send)
                                            
                                            # Remove the sent frame from the buffer
                                            audio_buffer = audio_buffer[REQUIRED_FRAME_SIZE:]
                                            
                                except Exception as e:
                                    logger.error(f"Error processing 'audio' event: {e}", exc_info=True)

                            elif event.type == "raw_model_event":
                                raw_event = event.data
                                # Handle vendor events for transcripts and turn markers
                                if getattr(raw_event, "type", "") == "transcript_delta":
                                    await emit_transport({
                                        "type": "conversation.item.input_audio_transcription.delta",
                                        "delta": getattr(raw_event, "delta", ""),
                                        "itemId": getattr(raw_event, "item_id", None),
                                    }, current_chat_id)
                                    # ✅ FIX: Also emit to Socket.IO for client-side transcript updates
                                    await sio.emit("conversation.item.input_audio_transcription.delta", {
                                        "chat_id": current_chat_id,
                                        "delta": getattr(raw_event, "delta", ""),
                                        "itemId": getattr(raw_event, "item_id", None),
                                    }, room=current_chat_id)
                                elif getattr(raw_event, "type", "") == "input_audio_buffer.speech_started":
                                    # ✅ FIX: Capture the timestamp when the user starts speaking
                                    user_turn_start_time = datetime.now(timezone.utc)
                                    event_type = getattr(raw_event, "type", "")
                                    await emit_transport({
                                        "type": event_type,
                                        "itemId": getattr(raw_event, "item_id", None),
                                    }, current_chat_id)
                                    # Also emit to Socket.IO for immediate client notification
                                    await sio.emit("server_vad_event", {
                                        "type": event_type,
                                        "chat_id": current_chat_id,
                                        "profile_id": profile_id,
                                    }, room=current_chat_id)
                                elif getattr(raw_event, "type", "") == "input_audio_buffer.speech_stopped":
                                    # ✅ NEW: Emit server VAD events to client for UI feedback
                                    event_type = getattr(raw_event, "type", "")
                                    await emit_transport({
                                        "type": event_type,
                                        "itemId": getattr(raw_event, "item_id", None),
                                    }, current_chat_id)
                                    # Also emit to Socket.IO for immediate client notification
                                    await sio.emit("server_vad_event", {
                                        "type": event_type,
                                        "chat_id": current_chat_id,
                                        "profile_id": profile_id,
                                    }, room=current_chat_id)
                                elif getattr(raw_event, "type", "") == "input_audio_transcription_completed":
                                    transcript_text = getattr(raw_event, "transcript", "") or ""
                                    item_id = getattr(raw_event, "item_id", None)
                                    await emit_transport({
                                        "type": "conversation.item.input_audio_transcription.completed",
                                        "transcript": transcript_text,
                                        "itemId": item_id,
                                    }, current_chat_id)
                                    # Persist user message mirroring training flow, but only if transcript is non-empty
                                    if transcript_text.strip():
                                        try:
                                            # Find user's persona by profile_id
                                            user_persona = db_session.exec(
                                                select(Personas).where(Personas.profile_id == profile_id)
                                            ).one_or_none()
                                            user_persona_id = user_persona.id if user_persona else None

                                            user_message = Messages(
                                                chat_id=current_chat_id,
                                                content=transcript_text.strip(),
                                                role="user",
                                                training_id=chat_obj.training_id,  # type: ignore[union-attr]
                                                completed=True,
                                                persona_id=user_persona_id,
                                                # ✅ FIX: Use the captured start time for consistency
                                                created_at=user_turn_start_time if user_turn_start_time else datetime.now(timezone.utc)
                                            )
                                            db_session.add(user_message)
                                            db_session.commit()
                                            db_session.refresh(user_message)

                                            await sio.emit(
                                                "user_message_saved",
                                                {
                                                    "chat_id": current_chat_id,
                                                    "message": {
                                                        "id": str(user_message.id),
                                                        "chat_id": str(user_message.chat_id),
                                                        "content": user_message.content,
                                                        "role": user_message.role,
                                                        "persona_id": str(user_persona_id) if user_persona_id else None,
                                                        "completed": user_message.completed,
                                                        "created_at": user_message.created_at.isoformat(),
                                                        "completed_at": user_message.completed_at.isoformat() if user_message.completed_at else None,
                                                    },
                                                },
                                                room=current_chat_id,
                                            )
                                            
                                            # ✅ FIX: Reset the start time for the next turn
                                            user_turn_start_time = None
                                        except Exception as ex:
                                            logger.error(f"VOICE_BRIDGE: Failed to persist user message: {ex}")
                                            db_session.rollback()
                                            # ✅ FIX: Also reset on failure to prevent bad state.
                                            user_turn_start_time = None
                                elif getattr(raw_event, "type", "") == "raw_server_event":
                                    data = getattr(raw_event, "data", {})
                                    evt_type = data.get("type") if isinstance(data, dict) else None
                                    if evt_type in ("response.text.delta", "response.audio_transcript.delta"):
                                        delta = data.get("delta", "")
                                        # Create assistant placeholder on first delta
                                        if assistant_message_id is None:
                                            try:
                                                assistant_message = Messages(
                                                    chat_id=current_chat_id,
                                                    content="",
                                                    role="assistant",
                                                    training_id=chat_obj.training_id,  # type: ignore[union-attr]
                                                    completed=False,
                                                    persona_id=persona_id,
                                                )
                                                db_session.add(assistant_message)
                                                db_session.commit()
                                                db_session.refresh(assistant_message)
                                                assistant_message_id = assistant_message.id
                                                await sio.emit(
                                                    "training_message_start",
                                                    {
                                                        "chat_id": current_chat_id,
                                                        "message_id": str(assistant_message_id),
                                                        "persona_id": str(persona_id),
                                                    },
                                                    room=current_chat_id,
                                                )
                                            except Exception as ex:
                                                logger.error(f"VOICE_BRIDGE: Failed to create assistant message: {ex}")
                                                db_session.rollback()  # Rollback failed transaction
                                        # Stream delta
                                        accumulated_assistant += delta
                                        await sio.emit(
                                            "training_message_token",
                                            {
                                                "chat_id": current_chat_id,
                                                "message_id": str(assistant_message_id) if assistant_message_id else "",
                                                "token": delta,
                                                "accumulated_content": accumulated_assistant,
                                            },
                                            room=current_chat_id,
                                        )
                                        await emit_transport({
                                            "type": evt_type,
                                            "delta": delta,
                                        }, current_chat_id)
                                    elif evt_type in ("response.text.done", "response.audio_transcript.done"):
                                        final_text = data.get("transcript", "")
                                        await emit_transport({
                                            "type": evt_type,
                                            "transcript": final_text,
                                        }, current_chat_id)
                                        # Finalize assistant message
                                        if assistant_message_id:
                                            try:
                                                msg = db_session.exec(
                                                    select(Messages).where(Messages.id == assistant_message_id)
                                                ).one_or_none()
                                                if msg:
                                                    msg.content = final_text
                                                    msg.completed = True
                                                    db_session.add(msg)
                                                    db_session.commit()
                                                await sio.emit(
                                                    "training_message_complete",
                                                    {
                                                        "chat_id": current_chat_id,
                                                        "message_id": str(assistant_message_id),
                                                        "final_content": final_text,
                                                    },
                                                    room=current_chat_id,
                                                )
                                            except Exception as ex:
                                                logger.error(f"VOICE_BRIDGE: Failed to finalize assistant message: {ex}")
                                                db_session.rollback()  # Rollback failed transaction
                                            finally:
                                                assistant_message_id = None
                                                accumulated_assistant = ""

                            elif event.type == "error":
                                logger.error(f"Fatal error in session: {event.error}")
                                shutdown_flag.set()  # Trigger shutdown
                                break
                            
                            # Note: Interruption logic is now implicitly handled by starting a new session
                            # when the user speaks again, so we don't need a special case for it here.
                    except Exception as e:
                        logger.error(f"Error in consume_session_events_turn: {e}", exc_info=True)
                    finally:
                        logger.info("Event consumer for turn has finished.")
                        shutdown_flag.set()

                # -- RUN AND CLEAN UP THE TASKS FOR THIS TURN --
                producer = asyncio.create_task(pump_incoming_audio_turn())
                consumer = asyncio.create_task(consume_session_events_turn())
                await asyncio.gather(producer, consumer)

            except asyncio.CancelledError:
                logger.info("Voice bridge task was cancelled.")
                break  # Exit the main while loop
            except ConnectionClosedOK:
                logger.info("WebRTC track ended. Closing voice bridge.")
                break
            except Exception as e:
                logger.error(f"Error in main voice bridge loop: {e}", exc_info=True)
                # Pause before restarting to prevent rapid-fire errors
                await asyncio.sleep(1)
            finally:
                if session:
                    await session.close()
                if db_session:
                    db_session.close()
                logger.info("Cleaned up resources for the turn.")



    @pc.on("track")
    async def on_track(track: MediaStreamTrack) -> None:
        logger.info(f"TRACK_EVENT: Received track: {track.kind} for profile {profile_id}")
        if track.kind == "audio":
            # --- START OF FIX ---
            # Get the socket ID to send a direct confirmation
            sid = await get_socket_owner(profile_id)
            if sid:
                # Tell the client that the server's audio bridge is now running and ready
                await sio.emit("webrtc_audio_ready", { "profile_id": profile_id }, room=sid)
                logger.info(f"Sent webrtc_audio_ready signal to client {sid}")
            # --- END OF FIX ---
            
            # If an old voice task is already running for this PC, cancel it.
            if hasattr(pc, "_voice_task") and not pc._voice_task.done():
                pc._voice_task.cancel()

            # Start the realtime voice bridge task. It will run in the background.
            setattr(pc, "_voice_task", asyncio.create_task(realtime_voice_bridge_task(track, server_audio_track)))
            
            @track.on("ended")
            async def on_ended():
                logger.info(f"TRACK_EVENT: Track {track.kind} ended for profile {profile_id}")
                # When the client's track ends (e.g., they switch from voice mode),
                # cancel our voice task to clean up resources.
                if hasattr(pc, "_voice_task") and not pc._voice_task.done():
                    pc._voice_task.cancel()

    @pc.on("datachannel")  # type: ignore
    def on_datachannel(channel: Any) -> None:
        logger.info(f"Received data channel: {channel.label} for profile {profile_id}")
        
        @channel.on("message")  # type: ignore
        def on_message(message: Any) -> None:
            # Handle incoming WebRTC data channel messages
            asyncio.create_task(handle_webrtc_data_message(profile_id, channel.label, message))
    
    profiles_live[profile_id] = pc
    return pc

async def send_text_dc(profile_id: str, payload: Dict[str, Any]) -> bool:
    """Try to push JSON over the text data-channel, return True if it worked."""
    pc = profiles_live.get(profile_id)
    if not pc:
        return False
        
    dc = getattr(pc, "_text_channel", None)
    if dc and dc.readyState == "open":
        try:
            dc.send(json.dumps(payload))
            logger.debug(f"Sent data-channel message to {profile_id}: {payload.get('type', 'unknown')}")
            return True
        except Exception as e:
            logger.error(f"Error sending data-channel message to {profile_id}: {e}")
            return False
    return False          # caller can fall back to socket.emit

async def handle_webrtc_data_message(profile_id: str, channel_label: str, message: Any) -> None:
    """Handle incoming WebRTC data channel messages."""
    try:
        logger.info(f"Received WebRTC data message on channel {channel_label} for profile {profile_id}")
        
        # Parse the message
        if isinstance(message, bytes):
            # Handle binary data (audio)
            data = json.loads(message.decode('utf-8'))
        else:
            # Handle text data
            data = json.loads(message)
        
        chat_id = data.get('chat_id')
        content = data.get('content', '')
        
        if not chat_id:
            logger.error(f"No chat_id in WebRTC message: {data}")
            return
        
        # MODIFIED: Directly route to training handler
        logger.info(f"Routing WebRTC message to training chat: {chat_id}")
        from app.web.training import process_training_message_websocket
        
        await process_training_message_websocket(
            chat_id=chat_id,
            message=content,
            profile_id=profile_id,
        )
        
    except Exception as e:
        logger.error(f"Error handling WebRTC data message: {e}")

async def handle_text_dc_message(profile_id: str, message: Any) -> None:
    """Handle incoming text data channel messages from client."""
    try:
        logger.info(f"Received text data-channel message for profile {profile_id}")
        
        # Parse the message
        if isinstance(message, bytes):
            data = json.loads(message.decode('utf-8'))
        else:
            data = json.loads(message) if isinstance(message, str) else message
        
        chat_id = data.get('chat_id')
        content = data.get('content', '')
        sketch_data = data.get('sketch_data')
        
        if not chat_id:
            logger.error(f"No chat_id in text data-channel message: {data}")
            return
        
        # Convert base64 sketch data to bytes if present
        sketch_bytes = None
        if sketch_data:
            try:
                # Remove data URL prefix if present (data:image/png;base64,)
                if sketch_data.startswith('data:'):
                    sketch_data = sketch_data.split(',', 1)[1]
                sketch_bytes = base64.b64decode(sketch_data)
                logger.info(f"Decoded sketch data from WebRTC: {len(sketch_bytes)} bytes")
            except Exception as e:
                logger.error(f"Error decoding sketch data from WebRTC: {e}")
                sketch_bytes = None
        
        # MODIFIED: Directly route to training handler
        logger.info(f"Routing message to training chat: {chat_id}")
        from app.web.training import process_training_message_websocket
        
        await process_training_message_websocket(
            chat_id=chat_id,
            message=content,
            profile_id=profile_id,
        )
        
    except Exception as e:
        logger.error(f"Error handling text data-channel message: {e}")

# ----------  Socket.IO with Redis message queue  ----------
redis_url = os.getenv("REDIS_URL")          # don't default when unset

if redis_url and socketio.AsyncRedisManager:
    logger.info(f"Socket.IO: clustering via Redis → {redis_url}")
    redis_manager = socketio.AsyncRedisManager(redis_url)
else:
    logger.info("Socket.IO: no REDIS_URL - using in-memory manager")
    redis_manager = None            # ⇢ default AsyncManager

kwargs = {}
if redis_manager is not None:        # only pass when we actually have it
    kwargs["client_manager"] = redis_manager

# Create Socket.IO server instance globally
sio = socketio.AsyncServer(
    **kwargs,
    cors_allowed_origins=allowed_origins,
    cors_credentials=True,
    logger=True,  # Enable logging for debugging
    engineio_logger=True,  # Enable engine.io logging
    async_mode='asgi',
    # Support both transports but prioritize websocket
    transports=['websocket', 'polling'],
    # Allow upgrades from polling to websocket
    allow_upgrades=True,
    # Optimized timeouts for faster connection
    ping_timeout=60,
    ping_interval=25,
    # Optimized Engine.IO options
    engineio_options={
        'max_http_buffer_size': 1000000,
        'ping_timeout': 60,
        'ping_interval': 25,
        'compression': False,  # Disable compression for better performance
        'cookie': False,  # Disable cookies for stateless operation
    }
)

# MODIFIED: Only register training events
from app.web.training import register_training_events

register_training_events(sio)

# Add training event handlers that correspond to client expectations
@sio.event  # type: ignore
async def training_joined(sid: str, data: Dict[str, Any]) -> None:
    """Handle training joined event - emit back to client"""
    logger.info(f"Training joined: {data}")
    await sio.emit("training_joined", data, room=sid)

@sio.event  # type: ignore
async def training_message_start(sid: str, data: Dict[str, Any]) -> None:
    """Handle training message start event - emit back to client"""
    logger.info(f"Training message start: {data}")
    await sio.emit("training_message_start", data, room=sid)

@sio.event  # type: ignore
async def training_message_token(sid: str, data: Dict[str, Any]) -> None:
    """Handle training message token event - emit back to client"""
    await sio.emit("training_message_token", data, room=sid)

@sio.event  # type: ignore
async def training_message_complete(sid: str, data: Dict[str, Any]) -> None:
    """Handle training message complete event - emit back to client"""
    logger.info(f"Training message complete: {data}")
    await sio.emit("training_message_complete", data, room=sid)

@sio.event  # type: ignore
async def training_message_error(sid: str, data: Dict[str, Any]) -> None:
    """Handle training message error event - emit back to client"""
    logger.error(f"Training message error: {data}")
    await sio.emit("training_message_error", data, room=sid)

@sio.event  # type: ignore
async def training_stopped(sid: str, data: Dict[str, Any]) -> None:
    """Handle training stopped event - emit back to client"""
    logger.info(f"Training stopped: {data}")
    await sio.emit("training_stopped", data, room=sid)

@sio.event  # type: ignore
async def training_ended(sid: str, data: Dict[str, Any]) -> None:
    """Handle training ended event - emit back to client"""
    logger.info(f"Training ended: {data}")
    await sio.emit("training_ended", data, room=sid)

@sio.event  # type: ignore
async def assessment_submitted(sid: str, data: Dict[str, Any]) -> None:
    """Handle assessment submitted event - emit back to client"""
    logger.info(f"Assessment submitted: {data}")
    await sio.emit("assessment_submitted", data, room=sid)

@sio.event  # type: ignore
async def feedback_generated(sid: str, data: Dict[str, Any]) -> None:
    """Handle feedback generated event - emit back to client"""
    logger.info(f"Feedback generated: {data}")
    await sio.emit("feedback_generated", data, room=sid)

@sio.event  # type: ignore
async def connect(sid: str, environ: Any, auth: Any) -> bool:
    """Handle WebSocket connection with robust, profile-based socket management."""
    query_string = environ.get('QUERY_STRING', '')
    profile_id = None
    if 'profileId=' in query_string:
        try:
            profile_id = query_string.split('profileId=')[1].split('&')[0]
        except IndexError:
            pass

    logger.info(f"Client connecting: sid={sid}, profile_id={profile_id}")

    if profile_id:
        # Check if another socket is already active for this profile
        old_sid = await get_socket_owner(profile_id)
        if old_sid and old_sid != sid:
            logger.warning(
                f"Profile {profile_id} already has active socket {old_sid}. "
                f"Closing old connection and accepting new one {sid}."
            )
            # Clean up the entire old session for this profile
            await cleanup_profile_connection(profile_id, "new socket takeover")
            # Forcefully disconnect the old socket from the server-side
            await sio.disconnect(old_sid, ignore_queue=True)

        # Store socket ownership
        await set_socket_owner(profile_id, sid)
        await sio.enter_room(sid, profile_id)
        
        # Update database to mark profile as active
        try:
            from app.db import get_session
            from app.models import Profiles
            
            db_session = next(get_session())
            try:
                profile = db_session.exec(
                    select(Profiles).where(Profiles.id == profile_id)
                ).one_or_none()
                
                if profile:
                    profile.active = True
                    profile.last_active = datetime.now(timezone.utc)
                    db_session.add(profile)
                    db_session.commit()
                    logger.info(f"Updated profile {profile_id} to active in database")
            finally:
                db_session.close()
        except Exception as e:
            logger.error(f"Error updating profile {profile_id} in database: {e}")

    # -----------------------------------------------------------------------+
    # 5.  Advertise server capabilities to the client once on connection     +
    # -----------------------------------------------------------------------+
    await sio.emit('server_capabilities', {
        'webrtc': WEBRTC_ENABLED,
        'audio':  WEBRTC_ENABLED,     # you disable TTS/mic together here
    }, room=sid)

    await sio.emit('connection_confirmed', {
        'sid': sid,
        'profile_id': profile_id,
        'server_time': time.time()
    }, room=sid)

    logger.info(f"Client connected successfully: sid={sid}, profile_id={profile_id}")
    return True

@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with immediate cleanup"""
    logger.info(f"Client disconnecting: {sid}")
    
    # Find and clean up profile for this socket
    profile_to_cleanup = await find_profile_by_socket(sid)
    
    if profile_to_cleanup:
        await cleanup_profile_connection(profile_to_cleanup, "socket disconnect")
    
    # Remove from active connections
    for chat_id, connection_sid in list(active_connections.items()):
        if connection_sid == sid:
            del active_connections[chat_id]
            break

# WebRTC-specific Socket.IO events with connection ID tracking
@sio.event  # type: ignore
async def webrtc_start(sid: str, data: Dict[str, Any]) -> None:
    """Start WebRTC connection for a profile"""
    try:
        profile_id = data.get('profile_id')
        if not profile_id:
            await sio.emit('webrtc_error', {
                'error': 'Missing profile_id'
            }, room=sid)
            return
        
        # Verify this socket owns this profile
        if await get_socket_owner(profile_id) != sid:
            await sio.emit('webrtc_error', {
                'error': 'Socket not authorized for this profile'
            }, room=sid)
            return
        
        logger.info(f"Starting WebRTC for profile {profile_id}")
        
        # Create new peer connection (this will close any existing one)
        pc = await get_pc(profile_id)
        
        # Create offer
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Debug: Log SDP structure to verify single audio track
        audio_lines = [line for line in offer.sdp.splitlines() if line.startswith('m=audio')]
        logger.info(f"SDP contains {len(audio_lines)} audio tracks for profile {profile_id}")
        
        # Send offer and ICE config to client
        await sio.emit('webrtc_offer', {
            'profile_id': profile_id,
            'offer': {
                'sdp': offer.sdp,
                'type': offer.type
            },
            'ice_config': _build_client_ice()
        }, room=sid)
        
        logger.info(f"Sent WebRTC offer to profile {profile_id}")
        
    except Exception as e:
        logger.error(f"Error starting WebRTC: {e}")
        await sio.emit('webrtc_error', {
            'error': str(e)
        }, room=sid)

@sio.event  # type: ignore
async def webrtc_answer(sid: str, data: Dict[str, Any]) -> None:
    """Handle WebRTC answer from client."""
    profile_id = data.get("profile_id")
    
    if not profile_id:
        logger.warning("Received webrtc_answer without profile_id")
        return

    # Verify profile exists and socket ownership
    if await get_socket_owner(profile_id) != sid:
        logger.warning(f"Received webrtc_answer for unauthorized profile: {profile_id}")
        return
        
    pc = profiles_live.get(profile_id)
    if not pc:
        logger.warning(f"Received webrtc_answer for non-existent peer connection for profile_id: {profile_id}")
        return
    
    # State guard: check if peer connection is still valid
    if pc.signalingState == "closed":
        logger.info(f"Stale signalling for closed PC {profile_id}, dropping")
        return
        
    logger.info(f"Received WebRTC answer from profile {profile_id}")
    try:
        answer_data = data.get('answer')
        if not answer_data:
            await sio.emit('webrtc_error', {
                'error': 'Missing answer in webrtc_answer'
            }, room=profile_id)
            return

        # 👇 THIS IS THE FIX 👇
        # Before setting the remote description, force it to use Opus
        modified_sdp = force_opus_codec(answer_data["sdp"])
        answer_obj = RTCSessionDescription(sdp=modified_sdp, type=answer_data["type"])
        # 👆 END OF FIX 👆
        await pc.setRemoteDescription(answer_obj)
        logger.info(f"Successfully set MODIFIED remote description for profile {profile_id}")

        # --- Process any buffered ICE candidates ---
        # Flush buffered candidates now that remote description is set
        buffered_candidates = pending_ice.pop(profile_id, [])
        for candidate in buffered_candidates:
            try:
                await pc.addIceCandidate(candidate)
                logger.info(f"Successfully added buffered ICE candidate for {profile_id}")
            except Exception as e:
                logger.error(f"Failed to add buffered ICE candidate for {profile_id}: {e}")
        
        await sio.emit("webrtc_ready", {
            "profile_id": profile_id
        }, room=profile_id)
        logger.info(f"WebRTC handshake complete, ready for profile {profile_id}")

    except Exception as e:
        logger.error(f"Error handling WebRTC answer: {e}", exc_info=True)
        await sio.emit('webrtc_error', {
            'error': f'Failed to process answer: {e}'
        }, room=profile_id)

@sio.event  # type: ignore
async def webrtc_ice_candidate(sid: str, data: dict[str, Any]) -> None:
    """Handle incoming ICE candidates from the client."""
    profile_id = data.get("profile_id")
    
    if not profile_id:
        logger.warning("Received webrtc_ice_candidate without profile_id")
        return

    # Verify profile exists and socket ownership
    if await get_socket_owner(profile_id) != sid:
        logger.warning(f"Received ICE candidate for unauthorized profile: {profile_id}")
        return

    pc = profiles_live.get(profile_id)
    if not pc:
        logger.warning(f"Received ICE candidate for non-existent peer connection: {profile_id}")
        return

    # State guard: check if peer connection is still valid
    if pc.signalingState == "closed":
        logger.info(f"Stale signalling for closed PC {profile_id}, dropping")
        return

    candidate_data = data.get("candidate")
    if not candidate_data:
        logger.info(f"End of ICE candidates signal received for profile {profile_id}")
        try:
            # An empty candidate signals the end of trickle ICE
            await pc.addIceCandidate(None)
        except Exception as e:
            logger.warning(f"Error adding null ICE candidate for {profile_id}, may already be closed: {e}")
        return

    try:
        # Reconstruct the RTCIceCandidate object from SDP string
        ice_candidate = candidate_from_sdp(candidate_data["candidate"])
        ice_candidate.sdpMid = candidate_data.get("sdpMid")
        ice_candidate.sdpMLineIndex = candidate_data.get("sdpMLineIndex")

        # Check if remote description is set before adding candidate
        if pc.remoteDescription is None:
            # Buffer the candidate until remote description is available
            pending_ice[profile_id].append(ice_candidate) # type: ignore
            logger.info(f"Buffered ICE candidate for {profile_id} (remote description not set yet)")
        else:
            # Process candidate immediately if remote description is available
            await pc.addIceCandidate(ice_candidate)
            logger.info(f"Successfully added ICE candidate for {profile_id}")

    except Exception as e:
        logger.error(
            f"Failed to process ICE candidate for profile {profile_id}: {e}",
            exc_info=True
        )

@sio.event  # type: ignore
async def webrtc_start_audio(sid: str, data: Dict[str, Any]) -> None:
    """Signal from client that they are starting to send an audio track, and trigger renegotiation."""
    profile_id = data.get("profile_id")
    chat_id = data.get("chat_id")
    
    if not profile_id or not chat_id:
        logger.error("Missing profile_id or chat_id for webrtc_start_audio")
        return

    # Add this log line for easier debugging
    logger.info(f"Client {sid} is starting audio for chat {chat_id}, beginning renegotiation.")
    
    # Verify profile exists and socket ownership
    if await get_socket_owner(profile_id) != sid:
        logger.error(f"Unauthorized audio start request for profile {profile_id}.")
        await sio.emit('webrtc_error', {'error': 'Profile not authorized.'}, room=sid)
        return
    
    pc = profiles_live.get(profile_id)
    if not pc:
        logger.error(f"No peer connection found for profile {profile_id} to start audio.")
        await sio.emit('webrtc_error', {'error': 'Peer connection not found.'}, room=sid)
        return

    # State guard: check if peer connection is still valid
    if pc.signalingState == "closed":
        logger.info(f"Cannot start audio for closed PC {profile_id}")
        await sio.emit('webrtc_error', {'error': 'Peer connection is closed.'}, room=sid)
        return

    # MODIFIED: Associate the chat_id with the connection
    pc.__dict__["_last_chat_id"] = chat_id

    try:
        # Create a new offer to trigger renegotiation
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        
        # Send the new offer to the client
        await sio.emit('webrtc_offer', {
            'profile_id': profile_id,
            'offer': {
                'sdp': offer.sdp,
                'type': offer.type
            },
            'ice_config': _build_client_ice() # Resending config might be needed by client
        }, room=sid)
        
        logger.info(f"Sent renegotiation offer to profile {profile_id} for chat {chat_id}")

    except Exception as e:
        logger.error(f"Error during audio start renegotiation for profile {profile_id}: {e}", exc_info=True)
        await sio.emit('webrtc_error', {'error': f'Failed to renegotiate for audio: {e}'}, room=sid)

@sio.event  # type: ignore
async def webrtc_stop_audio(sid: str, data: Dict[str, Any]) -> None:
    """Signal from client that they are stopping an audio track."""
    profile_id = data.get("profile_id")
    chat_id = data.get("chat_id")
    logger.info(f"Client {sid} is stopping audio for chat {chat_id}")
    # Here you would add logic to signal the audio processing task to stop.
    # For now, we'll just log it. A robust implementation would use an asyncio.Event or similar.

@sio.event  # type: ignore
async def webrtc_finalize_turn(sid: str, data: Dict[str, Any]) -> None:
    """
    ✅ DEPRECATED: With server VAD, turn finalization is automatic.
    This endpoint is kept for backward compatibility but is now a no-op.
    """
    profile_id = data.get("profile_id")
    if not profile_id:
        return

    # ✅ FIX: With server VAD, we don't need manual turn finalization
    # The server VAD automatically detects speech start/stop and manages turns
    logger.info(f"Received finalize_turn for profile {profile_id} - ignored (server VAD handles turn management)")

# SPEC CHANGE: Renegotiation answer handler is no longer needed
# The server now uses a persistent audio track, eliminating the need for renegotiation

@sio.event  # type: ignore
async def join_chat(sid: str, data: dict[str, Any]) -> None:
    """Join a specific chat room for real-time updates"""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.enter_room(sid, room_name)
        active_connections[chat_id] = sid
        logger.info(f"Client {sid} joined {chat_type} chat {chat_id} (room: {room_name})")
        await sio.emit('joined_chat', {'chat_id': chat_id, 'chat_type': chat_type}, room=sid)

@sio.event  # type: ignore
async def leave_chat(sid: str, data: dict[str, Any]) -> None:
    """Leave a specific chat room"""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.leave_room(sid, room_name)
        if chat_id in active_connections:
            del active_connections[chat_id]
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")

def store_active_run(chat_id: str, run_result: Any) -> None:
    """Store an active run for potential cancellation"""
    active_runs[chat_id] = run_result

def cancel_active_run(chat_id: str) -> bool:
    """Cancel an active run and clean up"""
    if chat_id in active_runs:
        result = active_runs[chat_id]
        try:
            result.cancel()
            del active_runs[chat_id]
            logger.info(f"Successfully cancelled active run for chat {chat_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling active run {chat_id}: {e}")
            del active_runs[chat_id]
            return False
    return False

async def emit_chat_stopped(chat_id: str, chat_type: str, message: str = "Chat stopped successfully") -> None:
    """Emit chat_stopped event to the appropriate room"""
    await sio.emit('chat_stopped', {
        'chat_id': chat_id,
        'chat_type': chat_type,
        'message': message
    }, room=f"{chat_type}_{chat_id}")

@sio.event  # type: ignore
async def stop_chat(sid: str, data: dict[str, Any]) -> None:
    """Handle chat stop requests via WebSocket. TODO: Fix this to work and be generic."""
    chat_id = data.get('chat_id')
    chat_type = data.get('chat_type', 'assistant')  # Default to assistant for backward compatibility
    
    if chat_id:
        room_name = f"{chat_type}_{chat_id}"
        await sio.emit('chat_stopped', {
            'chat_id': str(chat_id),
            'chat_type': chat_type
        }, room=sid)
        if chat_id in active_connections:
            del active_connections[chat_id]
        logger.info(f"Client {sid} left {chat_type} chat {chat_id}")

def get_socketio_instance() -> socketio.AsyncServer:
    """Get the global Socket.IO server instance"""
    return sio

# Create a combined lifespan to manage both session managers
@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[Any]:
    async with contextlib.AsyncExitStack():
        # Initialize Redis client for socket ownership management
        await init_redis_client()
        
        # Log WebRTC configuration
        logger.info("WebRTC Configuration:")
        logger.info(f"  TURN_USERNAME: {os.getenv('TURN_USERNAME', 'not set')}")
        logger.info(f"  TURN_PASSWORD: {'***' if os.getenv('TURN_PASSWORD') else 'not set'}")
        logger.info(f"  TURN_URI: {os.getenv('TURN_URI', 'not set')}")
        logger.info(f"  STUN_URI: {os.getenv('STUN_URI', 'not set')}")
        
        yield
        
        # Clean up Redis client on shutdown
        await cleanup_redis_client()

# Create FastAPI app with lifespan
fastapi_app = FastAPI(title="GLOW API", lifespan=lifespan)

# Add CORS middleware FIRST
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,  # Use the same origins as Socket.IO
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the combined ASGI app with Socket.IO
app = socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")


@fastapi_app.get("/")
async def root_info() -> JSONResponse:
    """
    Return general server information.
    """
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "fastapi_version": getattr(
            sys.modules.get("fastapi"), "__version__", "unknown"
        ),
    }
    return JSONResponse(content={"server_info": info})


@fastapi_app.get("/health")
async def health_check() -> JSONResponse:
    """
    Simple health check endpoint.
    """
    return JSONResponse(content={"status": "ok"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host="0.0.0.0", port=8000, reload=True, log_level="info"
    )

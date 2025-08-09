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
from agents.realtime import RealtimeSession
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

load_dotenv()

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

client_port = os.getenv("CLIENT_PORT", "3000")

# ---------------------------------------------------------------------------+
# 2.  CORS etc. remains intact                                               +
# ---------------------------------------------------------------------------+
# Allow all origins
allowed_origins = [
    f"http://localhost:{client_port}",
]

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

    def end_stream(self) -> None:
        """Signals the end of the stream by adding a None sentinel."""
        logger.info("Ending persistent server audio stream.")
        self.queue.put_nowait(None)

    # ✨ THIS IS THE CORRECT, SIMPLIFIED RECV METHOD
    async def recv(self) -> AudioFrame:
        """
        Pulls an audio chunk from the queue. If the queue is empty after a short
        timeout, it generates a 20ms frame of silence to keep the stream alive.
        """
        FRAME_SIZE_BYTES = 1920  # 960 samples * 2 bytes/sample (s16)
        FRAME_DURATION_S = 0.02  # 20ms

        try:
            # Wait for real audio, but with a timeout slightly less than the frame duration
            chunk = await asyncio.wait_for(self.queue.get(), timeout=FRAME_DURATION_S - 0.005)
        except asyncio.TimeoutError:
            # No real audio from the AI, so create a silent chunk
            chunk = b'\x00' * FRAME_SIZE_BYTES
        
        if chunk is None:
            self.stop()
            raise asyncio.CancelledError("Audio stream ended.")

        # Create the AudioFrame from the chunk (real or silent)
        frame = AudioFrame(format="s16", layout="mono", samples=960)
        frame.planes[0].update(chunk)

        # Set the presentation timestamp for smooth playback
        frame.sample_rate = 48000
        frame.pts = self._pts
        frame.time_base = self._time_base
        self._pts += frame.samples
        
        # This pacing is critical to prevent choppy audio.
        # Since this loop now runs continuously, this sleep ensures we send frames at a steady 50fps rate.
        await asyncio.sleep(FRAME_DURATION_S)
        
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
def _build_ice_servers() -> List[Dict[str, Any]]:
        
    turn_uri = os.getenv("TURN_URI", "")
    stun_uri = os.getenv("STUN_URI", "")
    user = os.getenv("TURN_USERNAME")
    pwd  = os.getenv("TURN_PASSWORD")

    if not (turn_uri and stun_uri):
        raise ValueError(
            "No ICE servers found in environment variables (TURN_URI/STUN_URI)."
        )

    # split on commas (and strip any whitespace)
    stun_uris = [u.strip() for u in stun_uri.split(",")]
    turn_uris = [u.strip() for u in turn_uri.split(",")]

    # Pre-warm TURN: Include both STUN and TURN in the same config
    # This allows the browser to start connecting to TURN in parallel with STUN
    ice_servers: List[Dict[str, Any]] = []
    
    if user and pwd:
        # Combined server config for parallel connection attempts
        ice_servers.append({
            "urls": stun_uris + turn_uris,
            "username": user,
            "credential": pwd,
        })
    else:
        # Fallback to STUN only
        ice_servers.append({
            "urls": stun_uris
        })

    logger.info(
        "Using ICE servers for WebRTC (pre-warmed): %s",
        ", ".join(stun_uris + (turn_uris if user and pwd else [])),
    )

    return ice_servers

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
            logger.info(f"Cancelled existing echo task for profile {profile_id}")
        await pc_old.close()

    # Convert our dict format to aiortc's RTCIceServer objects
    ice_servers_list = []
    for server_config in _build_ice_servers():
        if "username" in server_config and "credential" in server_config:
            ice_servers_list.append(RTCIceServer(
                urls=server_config["urls"],
                username=server_config["username"],
                credential=server_config["credential"]
            ))
        else:
            ice_servers_list.append(RTCIceServer(urls=server_config["urls"]))
    
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
        Bridges incoming WebRTC audio to the RealtimeSession and plays back
        generated audio while emitting text events.
        """
        session = None
        db_session = None
        
        try:
            logger.info(f"VOICE_BRIDGE_TASK: Starting for profile {profile_id}")

            from app.db import get_session
            from app.models import Chats, Messages, Personas
            from app.services.agents.voice.realtime import \
                create_realtime_voice_session
            from app.web.training import get_persona_id_from_chat

            db_session = next(get_session())
            chat_id_for_voice = getattr(pc, "_last_chat_id", None)
            
            if not chat_id_for_voice:
                logger.error("VOICE_BRIDGE_TASK: Missing chat_id.")
                return

            chat_obj = db_session.exec(select(Chats).where(Chats.id == chat_id_for_voice)).one_or_none()
            if not chat_obj:
                logger.error(f"VOICE_BRIDGE_TASK: Chat {chat_id_for_voice} not found.")
                return

            persona_id = get_persona_id_from_chat(db_session, chat_obj)
            if not persona_id:
                logger.error(f"VOICE_BRIDGE_TASK: No persona for chat {chat_id_for_voice}.")
                return

            session = await create_realtime_voice_session(persona_id, db_session)
            setattr(pc, "_realtime_session", session)
            
            logger.info("VOICE_BRIDGE_TASK: Priming outbound audio stream.")
            silence_chunk = b"\x00" * 1920
            for _ in range(25):
                out_track.add_chunk(silence_chunk)

            async def consume_session_events_task() -> None:
                logger.info("Starting to consume AI session events.")
                try:
                    async for event in session:
                        if event.type == "audio":
                            # This sends the AI's audio to the client
                            out_track.add_chunk(event.audio.data)
                        elif event.type == "raw_model_event":
                            # Handle transcription and other text-based events
                            # (Your existing detailed logic for this can remain here)
                            pass # Placeholder for your existing logic
                except Exception as e:
                    logger.error(f"Error in consume_session_events_task: {e}", exc_info=True)

            async def pump_incoming_audio_task() -> None:
                logger.info("Starting to pump user audio to AI session.")
                in_to_model_resampler = AudioResampler(format="s16", layout="mono", rate=24000)
                try:
                    while True:
                        in_frame = await in_track.recv()
                        for frame in in_to_model_resampler.resample(in_frame):
                            await session.send_audio(frame.to_ndarray()[0].tobytes(), commit=False)
                except asyncio.CancelledError:
                    pass # Normal exit
                except Exception as e:
                    logger.error(f"Error in pump_incoming_audio_task: {e}", exc_info=True)

            # Run both tasks concurrently
            consumer = asyncio.create_task(consume_session_events_task())
            producer = asyncio.create_task(pump_incoming_audio_task())
            await asyncio.gather(consumer, producer)

        except Exception as e:
            logger.error(f"Unhandled exception in voice bridge task: {e}", exc_info=True)
        finally:
            logger.info(f"VOICE_BRIDGE_TASK: Cleaning up and shutting down for profile {profile_id}.")
            if session:
                await session.close()
            if db_session:
                db_session.close()
            out_track.end_stream()



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
            'ice_config': _build_ice_servers()
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
            'ice_config': _build_ice_servers() # Resending config might be needed by client
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
    Client has signaled the end of a push-to-talk utterance.
    Finalize the turn by sending a final commit to the RealtimeSession.
    """
    profile_id = data.get("profile_id")
    if not profile_id:
        return

    pc = profiles_live.get(profile_id)
    if not pc:
        return

    session: RealtimeSession | None = getattr(pc, "_realtime_session", None)
    if session:
        try:
            # ✅ SOLUTION: Create and send 100ms of silence to satisfy the API.
            # The format is 24kHz, 16-bit mono PCM audio.
            # 24000 samples/sec * 0.1 sec * 2 bytes/sample = 4800 bytes.
            silence_chunk = b'\x00' * 4800
            
            await session.send_audio(silence_chunk, commit=True)
            
            logger.info(f"Finalized audio turn for profile {profile_id} by sending 100ms of silence.")
            
        except Exception as e:
            logger.error(f"Error finalizing audio turn for profile {profile_id}: {e}")
    else:
        logger.warning(f"No realtime session found for profile {profile_id}")

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

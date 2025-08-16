"""
Training WebSocket handlers for real-time training chat
Simplified version focused on core training functionality
"""

import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import socketio  # type: ignore
from app.db import get_session
from app.models import (Chats, Fields, Messages,  # ✨ Import Personas
                        Parameters, Personas)
from app.services.agents.assesment import run_assessment_agent
from app.services.agents.feedback import run_feedback_agent
from app.services.agents.generic import run_generic_agent
from app.services.agents.grade import run_grading_agent
from app.services.agents.hint import run_hint_agent
from app.utils.chat import get_conversation_history
from sqlalchemy import Column
from sqlmodel import select

logger = logging.getLogger(__name__)

# Global store for active training runs
active_training_runs: Dict[str, Any] = {}


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance
    return get_socketio_instance()


async def handle_join_training(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle training join requests via WebSocket
    Joins a specific chat room for training
    """
    try:
        logger.info(f"Received join_training request from {sid} with data: {data}")

        chat_id = data.get("chat_id")
        profile_id = data.get("profile_id")

        if not chat_id:
            logger.error(f"Missing chat_id in request from {sid}")
            await emit_error(sid, "Missing chat_id")
            return

        # Handle empty string profile_id as None for guest mode
        if profile_id == "" or profile_id == "null":
            profile_id = None

        logger.info(
            f"Processing training join: chat_id={chat_id}, profile_id={profile_id}, sid={sid}"
        )

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Get the chat to validate it exists
            result = db_session.exec(
                select(Chats).where(Chats.id == chat_id)
            )
            chat = result.one_or_none()
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            logger.info(f"Joining training chat {chat_id} for user {profile_id}")

            # Add the user to the chat room
            sio = get_sio_instance()
            await sio.enter_room(sid, chat_id)

            # Send success response
            await sio.emit(
                "training_joined",
                {
                    "success": True,
                    "chat_id": chat_id,
                    "message": "Successfully joined training room",
                },
                room=sid,
            )

            logger.info(f"User {sid} successfully joined training room {chat_id}")

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error joining training for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to join training: {str(e)}")


async def handle_stop_training(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle training stop requests via WebSocket
    Stops the current training message generation
    """
    try:
        chat_id = data.get("chat_id")

        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Verify the chat exists
            result = db_session.exec(
                select(Chats).where(Chats.id == chat_id)
            )
            chat = result.one_or_none()
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            # Stop any active training run for this chat
            if chat_id in active_training_runs:
                # Cancel the training run
                training_run = active_training_runs[chat_id]
                if hasattr(training_run, 'cancel'):
                    training_run.cancel()
                del active_training_runs[chat_id]
                success = True
                logger.info(f"Successfully cancelled training run for chat {chat_id}")
            else:
                success = False
                logger.warning(f"No active training run found for chat {chat_id}")

            sio_instance = get_sio_instance()

            # Emit stop signal via WebSocket
            await sio_instance.emit(
                "training_stopped",
                {
                    "chat_id": chat_id,
                    "success": success,
                    "message": "" if success else "No active training run found",
                },
                room=chat_id,
            )

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error stopping training for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to stop training: {str(e)}")


async def handle_end_training(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle training end requests via WebSocket
    Ends the training session and marks chat as completed
    """
    try:
        chat_id = data.get("chat_id")

        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Get the chat
            result = db_session.exec(
                select(Chats).where(Chats.id == chat_id)
            )
            chat = result.one_or_none()
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            # Mark the chat as completed
            chat.completed = True
            chat.completed_at = datetime.now(timezone.utc)
            db_session.add(chat)
            db_session.commit()

            logger.info(f"Training chat {chat_id} marked as completed")

            # Send success response
            sio = get_sio_instance()
            await sio.emit(
                "training_ended",
                {
                    "success": True,
                    "chat_id": chat_id,
                    "message": "Training session ended successfully",
                },
                room=chat_id,
            )

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error ending training for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to end training: {str(e)}")


def get_persona_id_from_chat(db_session, chat: Chats) -> Optional[uuid.UUID]:
    """
    Extract persona_id from chat's parameter_ids by finding the parameter with field_type 'persona'
    For interview training, randomly select between regular and cheating candidate if candidate persona is not set
    """
    if not chat.parameter_ids:
        return None
    
    try:
        # Get all parameters for this chat
        parameters = []
        for param_id in chat.parameter_ids:
            param = db_session.exec(
                select(Parameters).where(Parameters.id == param_id)
            ).one_or_none()
            if param:
                parameters.append(param)
        
        # Find the parameter that has a field with field_type 'persona'
        for param in parameters:
            if param.field_id:
                field = db_session.exec(
                    select(Fields).where(Fields.id == param.field_id)
                ).one_or_none()
                
                if field and field.field_type == 'persona' and param.value:
                    # The value should be the persona UUID
                    try:
                        return uuid.UUID(param.value)
                    except ValueError:
                        logger.warning(f"Invalid persona UUID in parameter {param.id}: {param.value}")
                        continue
        
        # Special handling for interview training: 50/50 chance of cheating vs selected personality
        if chat.training_type == 'interview':
            # Check if user selected a candidate persona
            selected_persona_id = None
            for param in parameters:
                if param.field_id:
                    field = db_session.exec(
                        select(Fields).where(Fields.id == param.field_id)
                    ).one_or_none()
                    
                    if field and field.name == 'Candidate Persona' and param.value:
                        selected_persona_id = param.value
                        break
            
            if selected_persona_id:
                # User selected a personality, now 50/50 chance of using it vs cheating
                is_cheating = random.choice([True, False])
                
                if is_cheating:
                    # Find the cheating candidate persona
                    cheating_persona = db_session.exec(
                        select(Personas).where(Personas.name == 'Cheating Candidate')
                    ).one_or_none()
                    if cheating_persona:
                        # Store this in the chat's feedback field for reference
                        if not chat.feedback:
                            chat.feedback = {}
                        chat.feedback['candidate_type'] = 'cheating'
                        chat.feedback['candidate_persona_id'] = str(cheating_persona.id)
                        chat.feedback['user_selected_persona'] = selected_persona_id
                        db_session.add(chat)
                        db_session.commit()
                        return cheating_persona.id
                else:
                    # Use the personality the user actually selected
                    if not chat.feedback:
                        chat.feedback = {}
                    chat.feedback['candidate_type'] = 'regular'
                    chat.feedback['candidate_persona_id'] = selected_persona_id
                    db_session.add(chat)
                    db_session.commit()
                    return uuid.UUID(selected_persona_id)
        
        return None
    except Exception as e:
        logger.error(f"Error extracting persona_id from chat {chat.id}: {str(e)}")
        return None


async def process_training_message_websocket(
    chat_id: str,
    message: str = "",
    session: Optional[Any] = None,
    profile_id: Optional[str] = None,
) -> None:
    """
    Process a training message and stream the response via WebSocket
    Uses the generic agent with the persona linked to the chat
    """
    
    # Use provided session or create new one
    if session is None:
        from app.db import get_session
        db_session = next(get_session())
        should_close_session = True
    else:
        db_session = session
        should_close_session = False

    try:
        # Get the chat
        result = db_session.exec(
            select(Chats).where(Chats.id == chat_id)
        )
        chat = result.one_or_none()
        if not chat:
            raise ValueError(f"Chat {chat_id} not found")

        if not message.strip():
            logger.warning(f"Empty message received for chat {chat_id}")
            return

        # ✨ 1. Find the user's persona ID from their profile ID
        user_persona_id = None
        if profile_id:
            user_persona_result = db_session.exec(
                select(Personas).where(Personas.profile_id == profile_id)
            ).one_or_none()
            if user_persona_result:
                user_persona_id = user_persona_result.id
            else:
                logger.error(f"Could not find a persona for profile_id {profile_id}")
                # Fallback or error handling
                raise ValueError(f"User persona not found for profile {profile_id}")

        # Create user message (in-memory, not saved with new field)
        user_message = Messages(
            chat_id=chat_id,
            content=message,
            role="user",
            training_id=chat.training_id,
            completed=True,
            persona_id=user_persona_id  # ✨ Associate with user's persona
        )
        db_session.add(user_message)
        db_session.commit()
        db_session.refresh(user_message)

        logger.info(f"Created user message {user_message.id} for chat {chat_id}")

        # Immediately confirm to the client that the user message was saved
        sio = get_sio_instance()
        await sio.emit("user_message_saved", {
            "chat_id": chat_id,
            # ✨ 2. Enrich the message payload with the persona_id
            "message": {
                "id": str(user_message.id),
                "chat_id": str(user_message.chat_id),
                "content": user_message.content,
                "role": user_message.role,
                "persona_id": str(user_persona_id) if user_persona_id else None,  # Add persona_id
                "completed": user_message.completed,
                "created_at": user_message.created_at.isoformat(),
                "completed_at": user_message.completed_at.isoformat() if user_message.completed_at else None,
            }
        }, room=chat_id)

        # ✨ 3. Get assistant's persona_id from chat parameters
        assistant_persona_id = get_persona_id_from_chat(db_session, chat)
        if not assistant_persona_id:
            logger.error(f"No persona found for chat {chat_id}")
            # Handle error...
            return

        # Create assistant message placeholder
        assistant_message = Messages(
            chat_id=chat_id,
            content="",
            role="assistant", 
            training_id=chat.training_id,
            completed=False,
            persona_id=assistant_persona_id  # ✨ Associate with assistant's persona
        )
        db_session.add(assistant_message)
        db_session.commit()
        db_session.refresh(assistant_message)

        # ✨ 4. Emit message start event with the assistant's persona_id
        await sio.emit("training_message_start", {
            "chat_id": chat_id,
            "message_id": str(assistant_message.id),
            "persona_id": str(assistant_persona_id)  # Add persona_id
        }, room=chat_id)

        # Get conversation history
        messages = db_session.exec(select(Messages).where(Messages.chat_id == chat_id)).all()
        conversation_history = get_conversation_history(messages)

        # Stream response using generic agent
        accumulated_content = ""
        try:
            # The agent run uses the persona_id already, which is great
            async for chunk in run_generic_agent(assistant_persona_id, conversation_history, db_session):
                accumulated_content += chunk
                
                # Emit token update
                await sio.emit("training_message_token", {
                    "chat_id": chat_id,
                    "message_id": str(assistant_message.id),
                    "token": chunk,
                    "accumulated_content": accumulated_content
                }, room=chat_id)

            # Update message with final content
            assistant_message.content = accumulated_content
            assistant_message.completed = True
            db_session.add(assistant_message)
            db_session.commit()

            # Emit completion
            await sio.emit("training_message_complete", {
                "chat_id": chat_id,
                "message_id": str(assistant_message.id),
                "final_content": accumulated_content
            }, room=chat_id)

            logger.info(f"Completed training message {assistant_message.id} for chat {chat_id}")

        except Exception as e:
            logger.error(f"Error generating training response: {str(e)}")
            
            # Mark message as error and emit error event
            assistant_message.error = str(e)
            assistant_message.completed = True
            db_session.add(assistant_message)
            db_session.commit()

            await sio.emit("training_message_error", {
                "chat_id": chat_id,
                "message_id": str(assistant_message.id),
                "error": str(e)
            }, room=chat_id)

    except Exception as e:
        logger.error(f"Error processing training message: {str(e)}")
        raise
    finally:
        if should_close_session:
            db_session.close()


# Simplified training message handler 
async def handle_send_training_message(sid: str, data: Dict[str, Any]) -> None:
    """Handle training message sending via WebSocket"""
    try:
        chat_id = data.get("chat_id")
        message = data.get("message", "")
        
        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return
            
        logger.info(f"Processing training message for chat {chat_id}")
        
        # Process the message
        await process_training_message_websocket(
            chat_id=chat_id,
            message=message
        )
        
    except Exception as e:
        logger.error(f"Error handling training message: {str(e)}")
        await emit_error(sid, f"Failed to process message: {str(e)}")


# Handler functions for assessment and feedback
async def handle_submit_assessment(sid: str, data: Dict[str, Any]) -> None:
    """Handle assessment submission"""
    try:
        chat_id = data.get("chat_id")
        responses = data.get("responses", {})
        
        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return
            
        # Process assessment submission
        result = await run_assessment_agent(chat_id)
        
        sio = get_sio_instance()
        await sio.emit("assessment_submitted", {
            "chat_id": chat_id,
            "success": result.get("success", False),
            "assessment_id": result.get("assessment_id")
        }, room=chat_id)
        
    except Exception as e:
        logger.error(f"Error submitting assessment: {str(e)}")
        await emit_error(sid, f"Failed to submit assessment: {str(e)}")


async def handle_generate_feedback(sid: str, data: Dict[str, Any]) -> None:
    """Handle feedback generation"""
    try:
        chat_id = data.get("chat_id")
        
        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return
            
        # Process feedback generation  
        result = await run_feedback_agent(chat_id)
        
        sio = get_sio_instance()
        await sio.emit("feedback_generated", {
            "chat_id": chat_id,
            "success": result.get("success", False),
            "feedback_id": result.get("feedback_id")
        }, room=chat_id)
        
    except Exception as e:
        logger.error(f"Error generating feedback: {str(e)}")
        await emit_error(sid, f"Failed to generate feedback: {str(e)}")


# Register training event handlers with socketio
def register_training_events(sio: socketio.AsyncServer) -> None:
    """Register training WebSocket event handlers"""
    
    @sio.event  # type: ignore
    async def join_training(sid: str, data: Dict[str, Any]) -> None:
        """Join a training chat room"""
        logger.info(f"join_training event triggered for sid={sid}")
        await handle_join_training(sid, data)
    
    @sio.event  # type: ignore  
    async def send_training_message(sid: str, data: Dict[str, Any]) -> None:
        """Send a training message"""
        logger.info(f"send_training_message event triggered for sid={sid}")
        await handle_send_training_message(sid, data)
    
    @sio.event  # type: ignore
    async def stop_training(sid: str, data: Dict[str, Any]) -> None:
        """Stop training message generation"""
        logger.info(f"stop_training event triggered for sid={sid}")
        await handle_stop_training(sid, data)
    
    @sio.event  # type: ignore
    async def end_training(sid: str, data: Dict[str, Any]) -> None:
        """End training session"""
        logger.info(f"end_training event triggered for sid={sid}")
        await handle_end_training(sid, data)
    
    @sio.event  # type: ignore
    async def submit_assessment(sid: str, data: Dict[str, Any]) -> None:
        """Submit assessment responses"""
        logger.info(f"submit_assessment event triggered for sid={sid}")
        await handle_submit_assessment(sid, data)
    
    @sio.event  # type: ignore
    async def generate_feedback(sid: str, data: Dict[str, Any]) -> None:
        """Generate feedback"""
        logger.info(f"generate_feedback event triggered for sid={sid}")
        await handle_generate_feedback(sid, data)
    
    logger.info("Successfully registered training WebSocket event handlers")


# Utility functions
async def emit_error(sid: str, message: str) -> None:
    """Emit error message to specific socket"""
    sio = get_sio_instance()
    await sio.emit("error", {"message": message}, room=sid)
    logger.error(f"Emitted error to {sid}: {message}")
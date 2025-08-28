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
from app.models import (Assessments, Attempts, Chats, Documents,  # ✨ Import Personas
                        Fields, Messages, Parameters, Personas, Questions, Rubrics,
                        Scenarios)
from app.services.agents.assesment import (
    run_assessment_agent, 
    run_training_specific_assessment,
    create_initial_assessment_with_training_questions
)
from app.services.agents.feedback import run_feedback_agent
from app.services.agents.generic import run_generic_agent
from app.services.agents.grade import run_grading_agent
from app.services.agents.hint import run_hint_agent
from app.services.agents.scenario import run_scenario_agent
from app.utils.chat import (get_conversation_history, get_parameter_history,
                            get_persona_id_from_chat, get_preamble)
from sqlalchemy import Column
from sqlmodel import select

logger = logging.getLogger(__name__)

# Global store for active training runs
active_training_runs: Dict[str, Any] = {}


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance
    return get_socketio_instance()


async def handle_start_training(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle training start requests via WebSocket
    Creates training attempt, chat, and initial message
    """
    try:
        logger.info(f"Received start_training request from {sid} with data: {data}")

        scenario_id = data.get("scenario_id")
        field_values = data.get("field_values", [])
        profile_id = data.get("profile_id")

        if not scenario_id:
            logger.error(f"Missing scenario_id in request from {sid}")
            await emit_error(sid, "Missing scenario_id")
            return

        # Handle empty string profile_id as None for guest mode
        if profile_id == "" or profile_id == "null":
            profile_id = None

        logger.info(
            f"Processing training start: scenario_id={scenario_id}, profile_id={profile_id}, sid={sid}"
        )

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Get the scenario to validate it exists
            result = db_session.exec(
                select(Scenarios).where(Scenarios.id == scenario_id)
            )
            scenario = result.one_or_none()
            if not scenario:
                await emit_error(sid, "Scenario not found")
                return

            # Create parameter records for text and numerical fields
            parameter_ids = []

            for field_value in field_values:
                field_id = field_value.get("fieldId")
                value = field_value.get("value", "")
                parameter_id = field_value.get("parameterId")

                # Handle persona and categorical fields
                if parameter_id:
                    # Single parameter ID (categorical or persona)
                    parameter_ids.append(parameter_id)
                else:
                    # For text, numerical, and document fields, create new parameters
                    # The value will be the actual text/number or document ID
                    new_param = Parameters(
                        field_id=field_id,
                        name=value,
                        value=value,
                    )
                    db_session.add(new_param)
                    db_session.commit()
                    db_session.refresh(new_param)
                    parameter_ids.append(str(new_param.id))

            # Create training attempt
            attempt = Attempts(
                training_id=scenario.training_id,
                profile_id=profile_id,
            )
            db_session.add(attempt)
            db_session.commit()
            db_session.refresh(attempt)

            # Create chat
            chat = Chats(
                attempt_id=attempt.id,
                title=scenario.title,
                profile_id=profile_id,
                voice="alloy",
                parameter_ids=parameter_ids,
                training_id=scenario.training_id
            )
            db_session.add(chat)
            db_session.commit()
            db_session.refresh(chat)

            # Document uploads are handled on the frontend before this call
            logger.info("Document uploads completed on frontend")

            # Get persona ID and any feedback updates using a separate session
            try:
                # Create a separate session for persona extraction to avoid transaction conflicts
                persona_session = next(get_session())
                try:
                    persona_id = get_persona_id_from_chat(
                        persona_session, 
                        str(chat.id), 
                        [str(pid) for pid in (chat.parameter_ids or [])]
                    )
                finally:
                    persona_session.close()
            except Exception as e:
                logger.error(f"Error getting persona ID for chat {chat.id}: {str(e)}")
                persona_id = None

            # Run scenario agent to update chat title and description
            try:
                if not persona_id:
                    logger.error(f"No persona ID found for chat {chat.id}")
                    await emit_error(sid, "No persona ID found")
                    return
                
                logger.info(f"Running scenario agent for chat {chat.id}")
                scenario_result = await run_scenario_agent(chat.id, persona_id, db_session)
                
                if scenario_result.get("success"):
                    logger.info(f"Successfully updated chat with scenario: {scenario_result.get('chat_title')}")
                else:
                    logger.warning(f"Scenario agent failed: {scenario_result.get('message')}")
            except Exception as e:
                logger.error(f"Error running scenario agent: {str(e)}")
                # Continue with training even if scenario agent fails

            # Generate training-specific assessment questions early (3 questions)
            # This allows them to be ready instantly when training ends
            try:
                logger.info(f"🔍 DEBUG: Starting training-specific assessment generation for chat {chat.id}")
                training_questions_result = await run_training_specific_assessment(chat.id, db_session)
                
                logger.info(f"🔍 DEBUG: Training questions result: {training_questions_result}")
                
                if training_questions_result.get("success"):
                    # Create assessment with training-specific questions only (3 questions)
                    # The remaining questions will be added when training ends
                    training_questions = training_questions_result.get("questions", [])
                    logger.info(f"🔍 DEBUG: Got {len(training_questions)} training questions: {[q.get('question', 'No question text') for q in training_questions]}")
                    
                    assessment_result = await create_initial_assessment_with_training_questions(
                        chat.id, 
                        training_questions,
                        db_session
                    )
                    
                    logger.info(f"🔍 DEBUG: Assessment creation result: {assessment_result}")
                    
                    if assessment_result.get("success"):
                        logger.info(f"✅ Successfully created assessment {assessment_result.get('assessment_id')} with {len(training_questions)} training-specific questions")
                    else:
                        logger.error(f"❌ Failed to create assessment: {assessment_result.get('message')}")
                else:
                    logger.error(f"❌ Training-specific assessment generation failed: {training_questions_result.get('message')}")
            except Exception as e:
                logger.error(f"❌ Error generating training-specific assessment questions: {str(e)}")
                import traceback
                logger.error(f"❌ Traceback: {traceback.format_exc()}")
                # Continue with training even if assessment generation fails

            logger.info(f"Successfully created training session: attempt_id={attempt.id}, chat_id={chat.id}")

            # Send success response
            sio = get_sio_instance()
            await sio.emit(
                "training_started",
                {
                    "success": True,
                    "attempt_id": str(attempt.id),
                    "chat_id": str(chat.id),
                    "training_id": str(scenario.training_id),
                    "message": "Training session started successfully",
                },
                room=sid,
            )

        finally:
            try:
                db_session.close()
            except Exception as close_error:
                logger.error(f"Error closing database session: {str(close_error)}")

    except Exception as e:
        logger.error(f"Error starting training for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to start training: {str(e)}")


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
    Ends the training session, marks chat as completed, and runs assessment agent
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

            # Check if assessment with training questions already exists
            existing_assessment = db_session.exec(
                select(Assessments).where(Assessments.chat_id == chat_id)
            ).first()

            logger.info(f"🔍 DEBUG: Looking for existing assessment for chat {chat_id}")
            
            if existing_assessment:
                # Count existing questions
                existing_questions = db_session.exec(
                    select(Questions).where(Questions.assessment_id == existing_assessment.id)
                ).all()
                
                logger.info(f"🔍 DEBUG: Found existing assessment {existing_assessment.id} with {len(existing_questions)} questions")
                logger.info(f"🔍 DEBUG: Questions: {[(q.stem[:50] + '...' if len(q.stem) > 50 else q.stem, q.default_question) for q in existing_questions]}")
                
                logger.info(f"✅ Found existing assessment {existing_assessment.id}, sending immediate response")
                
                # Send immediate success response with assessment ready
                sio = get_sio_instance()
                await sio.emit(
                    "training_ended",
                    {
                        "success": True,
                        "chat_id": chat_id,
                        "message": "Training session ended successfully",
                        "assessment_ready": True,  # Assessment is immediately available (3 questions)
                        "assessment_id": str(existing_assessment.id),
                    },
                    room=chat_id,
                )
                
                # Now add conversation-specific and general questions in the background
                # This doesn't block the user interface
                try:
                    logger.info(f"Adding conversation-specific questions to assessment {existing_assessment.id}")
                    assessment_result = await run_assessment_agent(uuid.UUID(chat_id), db_session)
                    
                    if assessment_result.get("success"):
                        logger.info(f"Successfully completed assessment with all 7 questions")
                        # The assessment_completed event will be emitted by run_assessment_agent
                    else:
                        logger.warning(f"Failed to add conversation questions: {assessment_result.get('message')}")
                except Exception as e:
                    logger.error(f"Error adding conversation questions: {str(e)}")
                    # Continue even if this fails - user can still take the 3-question assessment

                # Run grading agent since assessment exists
                # This runs in the background and allows grades to be ready when user finishes assessment
                try:
                    # Get the scenario to find the rubric_id
                    scenario_result = db_session.exec(
                        select(Scenarios).where(Scenarios.training_id == chat.training_id)
                    ).first()
                    
                    if scenario_result and scenario_result.rubric_id:
                        logger.info(f"Running grading agent for chat {chat_id} with rubric {scenario_result.rubric_id}")
                        # Create a new session for the grading agent to avoid conflicts
                        grading_session = next(get_session())
                        try:
                            rubric_grade_id = await run_grading_agent(uuid.UUID(chat_id), scenario_result.rubric_id, grading_session)
                            logger.info(f"Successfully generated grades for chat {chat_id}, grade_id: {rubric_grade_id}")
                            
                            # Notify client that grading is complete
                            sio = get_sio_instance()
                            await sio.emit("grading_completed", {
                                "chat_id": chat_id,
                                "rubric_grade_id": rubric_grade_id,
                                "message": "Grading completed successfully"
                            }, room=chat_id)
                        finally:
                            grading_session.close()
                    else:
                        logger.warning(f"No rubric found for training {chat.training_id}, skipping grading")
                except Exception as grading_error:
                    logger.error(f"Error running grading agent: {str(grading_error)}")
                    # Continue even if grading agent fails
                    
            else:
                logger.warning(f"No existing assessment found for chat {chat_id}")
                # Fallback - send response indicating assessment may not be ready
                sio = get_sio_instance()
                await sio.emit(
                    "training_ended",
                    {
                        "success": True,
                        "chat_id": chat_id,
                        "message": "Training session ended successfully",
                        "assessment_ready": False,  # Assessment may not be complete
                    },
                    room=chat_id,
                )

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error ending training for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to end training: {str(e)}")


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
        try:
            # Create a separate session for persona extraction to avoid transaction conflicts
            persona_session = next(get_session())
            try:
                assistant_persona_id = get_persona_id_from_chat(
                    persona_session, 
                    str(chat.id), 
                    [str(pid) for pid in (chat.parameter_ids or [])]
                )
                if not assistant_persona_id:
                    logger.error(f"No persona found for chat {chat_id}")
                    # Handle error...
                    return
            finally:
                persona_session.close()
        except Exception as e:
            logger.error(f"Error getting assistant persona ID for chat {chat_id}: {str(e)}")
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
        preamble = get_preamble(chat)
        parameter_history = get_parameter_history(chat, db_session)
        conversation_history = get_conversation_history(messages)

        instructions = [preamble] + parameter_history + conversation_history

        # Stream response using generic agent
        accumulated_content = ""
        try:
            # The agent run uses the persona_id already, which is great
            async for chunk in run_generic_agent(assistant_persona_id, instructions, db_session):
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
        # Try to rollback if we have a session
        if db_session and should_close_session:
            try:
                db_session.rollback()
            except Exception as rollback_error:
                logger.error(f"Error rolling back transaction: {str(rollback_error)}")
        raise
    finally:
        if should_close_session:
            try:
                db_session.close()
            except Exception as close_error:
                logger.error(f"Error closing database session: {str(close_error)}")


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


# Handler functions for hints and assessment
async def handle_get_hints(sid: str, data: Dict[str, Any]) -> None:
    """Handle hints generation"""
    try:
        chat_id = data.get("chat_id")
        message_id = data.get("message_id")
        
        if not chat_id or not message_id:
            await emit_error(sid, "Missing chat_id or message_id")
            return
            
        # Process hints generation
        result = await run_hint_agent(uuid.UUID(message_id))
        
        sio = get_sio_instance()
        await sio.emit("hints_generated", {
            "chat_id": chat_id,
            "success": result.get("success", False),
            "hints": result.get("hints", []),
            "message": result.get("message", "")
        }, room=chat_id)
        
    except Exception as e:
        logger.error(f"Error generating hints: {str(e)}")
        await emit_error(sid, f"Failed to generate hints: {str(e)}")


async def handle_submit_assessment(sid: str, data: Dict[str, Any]) -> None:
    """Handle assessment submission and feedback generation"""
    try:
        chat_id = data.get("chat_id")
        responses = data.get("responses", {})
        
        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return
            
        # Run feedback agent to generate feedback (assessment already generated when training ended)
        feedback_result = await run_feedback_agent(uuid.UUID(chat_id))
        
        sio = get_sio_instance()
        await sio.emit("assessment_submitted", {
            "chat_id": chat_id,
            "success": True,
            "feedback_id": feedback_result.get("feedback_id"),
            "message": "Assessment submitted and feedback generated successfully"
        }, room=chat_id)
        
    except Exception as e:
        logger.error(f"Error submitting assessment: {str(e)}")
        await emit_error(sid, f"Failed to submit assessment: {str(e)}")


# Register training event handlers with socketio
def register_training_events(sio: socketio.AsyncServer) -> None:
    """Register training WebSocket event handlers"""
    
    @sio.event  # type: ignore
    async def start_training(sid: str, data: Dict[str, Any]) -> None:
        """Start a new training session"""
        logger.info(f"start_training event triggered for sid={sid}")
        await handle_start_training(sid, data)
    
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
    async def get_hints(sid: str, data: Dict[str, Any]) -> None:
        """Get hints for a message"""
        logger.info(f"get_hints event triggered for sid={sid}")
        await handle_get_hints(sid, data)
    
    @sio.event  # type: ignore
    async def submit_assessment(sid: str, data: Dict[str, Any]) -> None:
        """Submit assessment responses and generate feedback"""
        logger.info(f"submit_assessment event triggered for sid={sid}")
        await handle_submit_assessment(sid, data)
    
    logger.info("Successfully registered training WebSocket event handlers")


# Utility functions
async def emit_error(sid: str, message: str) -> None:
    """Emit error message to specific socket"""
    sio = get_sio_instance()
    await sio.emit("error", {"message": message}, room=sid)
    logger.error(f"Emitted error to {sid}: {message}")
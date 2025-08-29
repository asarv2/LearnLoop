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
from app.models import (Assessments, Attempts, Chats,  # ✨ Import Personas
                        Documents, Fields, Messages, Parameters, Personas,
                        Questions, Rubrics, Scenarios)
from app.services.agents.assesment import (
    create_initial_assessment_with_training_questions, run_assessment_agent,
    run_training_specific_assessment)
from app.services.agents.feedback import run_feedback_agent
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
            sio.start_background_task(sio.emit,
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
            sio.start_background_task(sio.emit,
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
            sio_instance.start_background_task(sio_instance.emit,
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
                sio.start_background_task(sio.emit,
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
                
                # Move heavy operations to background to avoid blocking the event loop
                async def _bg_assessment_and_grading():
                    try:
                        def _run_assessment_sync(cid: uuid.UUID):
                            import asyncio as _asyncio

                            # ❌ don't pass db_session across threads
                            return _asyncio.run(run_assessment_agent(cid))
                        await asyncio.to_thread(_run_assessment_sync, uuid.UUID(chat_id))
                    except Exception:
                        logger.exception("Assessment background job failed")
                    try:
                        # Fresh session inside background task
                        def _run_grading_sync(cid: uuid.UUID, rubric_id):
                            import asyncio as _asyncio

                            from app.db import get_session as _gs
                            sess = next(_gs())
                            try:
                                return _asyncio.run(run_grading_agent(cid, rubric_id, sess))
                            finally:
                                sess.close()
                        
                        # Get the scenario to find the rubric_id
                        scenario_result = db_session.exec(
                            select(Scenarios).where(Scenarios.training_id == chat.training_id)
                        ).first()
                        
                        if scenario_result and scenario_result.rubric_id:
                            rubric_grade_id = await asyncio.to_thread(_run_grading_sync, uuid.UUID(chat_id), scenario_result.rubric_id)
                            sio = get_sio_instance()
                            await sio.emit("grading_completed", {
                                "chat_id": chat_id,
                                "rubric_grade_id": rubric_grade_id,
                                "message": "Grading completed successfully"
                            }, room=chat_id)
                    except Exception:
                        logger.exception("Grading background job failed")
                asyncio.create_task(_bg_assessment_and_grading())
                    
            else:
                logger.warning(f"No existing assessment found for chat {chat_id}")
                # Fallback - send response indicating assessment may not be ready
                sio = get_sio_instance()
                sio.start_background_task(sio.emit,
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



# Simplified training message handler 
async def handle_send_training_message(sid: str, data: Dict[str, Any]) -> None:
    """
    New path: NO run_generic_agent.
    - We just append a *final* user text message into the room.
    - OpenAIAgent (wired to the room) forwards it to the model.
    - The store persists to DB and emits user_message_saved.
    - Assistant chunks from OpenAIAgent call append_text_chunk(role="agent", ...)
      → store emits training_message_* as they stream in.
    """
    try:
        chat_id = data.get("chat_id")
        message = (data.get("message") or "").strip()
        if not chat_id or not message:
            await emit_error(sid, "Missing chat_id or message")
            return

        from app.room import get_room
        room = get_room(chat_id)

        # Get profile_id from sid for persona mapping
        from app.main import get_profile_id_for_sid
        profile_id = get_profile_id_for_sid(sid)
        
        # Get user persona_id if available
        persona_id = None
        if profile_id:
            db_session = next(get_session())
            try:
                from app.models import Personas
                user_persona_result = db_session.exec(
                    select(Personas).where(Personas.profile_id == profile_id)
                ).one_or_none()
                if user_persona_result:
                    persona_id = str(user_persona_result.id)
            finally:
                db_session.close()

        # Persona mapping is optional. You can derive persona_id from chat parameters
        # if you want it on user rows too; or omit.
        await room.append_text_chunk(
            source_id=sid,     # or profile id
            role="user",
            text=message,
            message_id=None,
            chunk_idx=0,
            is_final=True,
            persona_id=persona_id,
        )
    except Exception as e:
        logger.error(f"Error handling training message: {str(e)}")
        await emit_error(sid, f"Failed to process message: {str(e)}")


# Handler functions for hints and assessment
async def handle_get_hints(sid: str, data: Dict[str, Any]) -> None:
    """Handle hints generation without blocking the event loop."""
    chat_id = data.get("chat_id")
    message_id = data.get("message_id")
    if not chat_id or not message_id:
        await emit_error(sid, "Missing chat_id or message_id")
        return

    # Fire a background job in a thread so the main loop stays hot.
    async def _bg():
        try:
            def _sync_wrapper(msg_id: uuid.UUID):
                # Run the async hint routine on a dedicated loop in this worker thread
                import asyncio as _asyncio
                return _asyncio.run(run_hint_agent(msg_id))

            result = await asyncio.to_thread(_sync_wrapper, uuid.UUID(message_id))

            sio = get_sio_instance()
            await sio.emit("hints_generated", {
                "chat_id": chat_id,
                "success": result.get("success", False),
                "hints": result.get("hints", []),
                "message": result.get("message", "")
            }, room=chat_id)
        except Exception as e:
            logger.exception("Error generating hints (bg)")
            await emit_error(sid, f"Failed to generate hints: {e}")

    # Don't await; schedule and return immediately.
    asyncio.create_task(_bg())


async def handle_submit_assessment(sid: str, data: Dict[str, Any]) -> None:
    """Handle assessment submission and feedback generation without blocking the event loop."""
    chat_id = data.get("chat_id")
    responses = data.get("responses", {})
    
    if not chat_id:
        await emit_error(sid, "Missing chat_id")
        return
        
    # Fire a background job in a thread so the main loop stays hot.
    async def _bg():
        try:
            def _sync_wrapper(cid: uuid.UUID):
                import asyncio as _asyncio
                return _asyncio.run(run_feedback_agent(cid))
            feedback_result = await asyncio.to_thread(_sync_wrapper, uuid.UUID(chat_id))
            sio = get_sio_instance()
            await sio.emit("assessment_submitted", {
                "chat_id": chat_id,
                "success": True,
                "feedback_id": feedback_result.get("feedback_id"),
                "message": "Assessment submitted and feedback generated successfully"
            }, room=chat_id)
        except Exception as e:
            logger.exception("Error submitting assessment (bg)")
            await emit_error(sid, f"Failed to submit assessment: {e}")
    asyncio.create_task(_bg())
    return


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
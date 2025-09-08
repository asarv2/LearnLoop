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
from agents import Runner, trace
from app.db import get_session
from app.models import (Assessments, Attempts, Chats,  # ✨ Import Personas
                        Documents, Fields, Messages, Parameters, Personas,
                        Questions, Rubrics, Scenarios)
from app.services.agents.assesment import (
    create_initial_assessment_with_training_questions, run_assessment_agent,
    run_training_specific_assessment)
from app.services.agents.feedback import run_feedback_agent
from app.services.agents.generic import GenericAgent, run_generic_agent
from app.services.agents.grade import run_grading_agent
from app.services.agents.hint import run_hint_agent
from app.services.agents.scenario import ScenarioResponse, get_scenario_prompt
from app.utils.chat import (get_conversation_history, get_parameter_history,
                            get_parameter_history_from_field_values,
                            get_parameter_history_simple,
                            get_persona_id_from_chat, get_preamble)
from sqlalchemy import Column
from sqlmodel import select

logger = logging.getLogger(__name__)

# Global store for active training runs
active_training_runs: Dict[str, Any] = {}


async def _schedule_hints_for_message(chat_id: str, message_id: str) -> None:
    """Background hint generation keyed to a specific assistant message."""
    try:
        def _sync(msg_uuid: uuid.UUID):
            import asyncio as _asyncio
            return _asyncio.run(run_hint_agent(msg_uuid))
        result = await asyncio.to_thread(_sync, uuid.UUID(message_id))
        sio = get_sio_instance()
        await sio.emit(
            "hints_generated",
            {
                "chat_id": chat_id,
                "message_id": message_id,              # ★ add message_id
                "success": result.get("success", False),
                "hints": result.get("hints", []),
                "message": result.get("message", ""),
            },
            room=chat_id,
        )
    except Exception as e:
        await emit_error(chat_id, f"Failed to generate hints: {e}")


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
        scenario_draft = data.get("scenario_draft")  # optional { title, problem_statement, objectives, parent_id }

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
            # Get the scenario to validate it exists (parent if draft provided)
            parent_scenario_id = scenario_draft.get("parent_id") if isinstance(scenario_draft, dict) else None
            lookup_id = parent_scenario_id or scenario_id
            result = db_session.exec(
                select(Scenarios).where(Scenarios.id == lookup_id)
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

            # Duplicate scenario at start if draft provided; else use existing
            scenario_to_use_id = None
            if isinstance(scenario_draft, dict) and scenario_draft.get("title") and scenario_draft.get("problem_statement") is not None:
                try:
                    # Duplicate minimal scenario row
                    new_scenario = Scenarios(
                        title=scenario_draft.get("title") or scenario.title,
                        # Keep description same as parent
                        description=getattr(scenario, "description", None),
                        training_id=scenario.training_id,
                        rubric_id=scenario.rubric_id,
                        field_ids=scenario.field_ids,
                        problem_statement=scenario_draft.get("problem_statement") or "",
                        objectives=scenario_draft.get("objectives") or [],
                        parent_id=scenario.id,
                    )
                    db_session.add(new_scenario)
                    db_session.commit()
                    db_session.refresh(new_scenario)
                    scenario_to_use_id = str(new_scenario.id)
                except Exception as e:
                    logger.error(f"Error duplicating scenario at start: {e}")
                    scenario_to_use_id = str(scenario.id)
            else:
                scenario_to_use_id = str(scenario.id)

            # Create chat
            chat = Chats(
                attempt_id=attempt.id,
                title=scenario.title if not isinstance(scenario_draft, dict) or not scenario_draft.get("title") else scenario_draft.get("title"),
                profile_id=profile_id,
                voice="alloy",
                parameter_ids=parameter_ids,
                training_id=scenario.training_id
            )
            # Optionally set scenario_id if model supports it
            try:
                setattr(chat, "scenario_id", scenario_to_use_id)
            except Exception:
                pass
            db_session.add(chat)
            db_session.commit()
            db_session.refresh(chat)

            # Document uploads are handled on the frontend before this call
            logger.info("Document uploads completed on frontend")

            # Get persona ID and attach a default persona parameter if missing
            try:
                # Create a separate session for persona extraction to avoid transaction conflicts
                persona_session = next(get_session())
                try:
                    param_ids_iter = chat.parameter_ids if chat.parameter_ids is not None else []
                    persona_id = get_persona_id_from_chat(
                        persona_session,
                        str(chat.id),
                        [str(pid) for pid in param_ids_iter]
                    )
                finally:
                    try:
                        persona_session.close()
                    except Exception:
                        pass
            except Exception as e:
                logger.error(f"Error getting persona ID for chat {chat.id}: {str(e)}")
                persona_id = None

            # If no persona is found, attempt to attach a default persona parameter
            if not persona_id:
                try:
                    # Find a persona field from the scenario's fields
                    persona_field_id = None
                    field_ids_list: list[uuid.UUID] = []
                    scenario_field_ids = getattr(scenario, "field_ids", None)
                    if scenario_field_ids is not None:
                        field_ids_list = list(scenario_field_ids)
                    for fid in field_ids_list:
                        fld = db_session.exec(select(Fields).where(Fields.id == fid)).one_or_none()
                        if fld and getattr(fld, "field_type", None) == "persona":
                            persona_field_id = fld.id
                            break

                    if persona_field_id:
                        # Pick a default persona parameter (latest updated or first available)
                        candidate_param = db_session.exec(
                            select(Parameters).where(Parameters.field_id == persona_field_id)
                        ).first()

                        if candidate_param and candidate_param.id:
                            existing_ids = list(chat.parameter_ids) if chat.parameter_ids is not None else []
                            updated_parameter_ids: list[uuid.UUID] = existing_ids + [candidate_param.id]
                            chat.parameter_ids = updated_parameter_ids
                            db_session.add(chat)
                            db_session.commit()
                            db_session.refresh(chat)

                            # Re-evaluate persona_id after attaching
                            try:
                                persona_session2 = next(get_session())
                                try:
                                    param_ids_iter2 = chat.parameter_ids if chat.parameter_ids is not None else []
                                    persona_id = get_persona_id_from_chat(
                                        persona_session2,
                                        str(chat.id),
                                        [str(pid) for pid in param_ids_iter2]
                                    )
                                finally:
                                    try:
                                        persona_session2.close()
                                    except Exception:
                                        pass
                            except Exception as e:
                                logger.error(f"Error re-evaluating persona ID for chat {chat.id}: {str(e)}")
                    else:
                        logger.warning(f"No persona field configured on scenario {scenario.id}; assistant persona will be unset")
                except Exception:
                    logger.exception("Failed to attach default persona parameter to chat")

            # Skip old scenario agent and initial message

            # Emit started immediately after scenario generation completes
            logger.info(f"Successfully created training session: attempt_id={attempt.id}, chat_id={chat.id}")

            sio = get_sio_instance()
            sio.start_background_task(
                sio.emit,
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

            # Schedule training-specific assessment generation in the background
            async def _bg_training_questions(cid: uuid.UUID) -> None:
                try:
                    logger.info(f"🔍 DEBUG: (bg) Starting training-specific assessment generation for chat {cid}")
                    sess = next(get_session())
                    try:
                        training_questions_result = await run_training_specific_assessment(cid, sess)
                        logger.info(f"🔍 DEBUG: (bg) Training questions result: {training_questions_result}")
                        if training_questions_result.get("success"):
                            training_questions = training_questions_result.get("questions", [])
                            if training_questions:
                                assessment_result = await create_initial_assessment_with_training_questions(
                                    cid,
                                    training_questions,
                                    sess,
                                )
                                logger.info(f"🔍 DEBUG: (bg) Assessment creation result: {assessment_result}")
                            else:
                                logger.warning(f"(bg) No training questions generated for chat {cid}")
                        else:
                            logger.error(f"❌ (bg) Training-specific assessment generation failed: {training_questions_result.get('message')}")
                    finally:
                        try:
                            sess.close()
                        except Exception:
                            pass
                except Exception:
                    logger.exception("❌ (bg) Error generating training-specific assessment questions")

            asyncio.create_task(_bg_training_questions(chat.id))

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
            try:
                db_session.close()
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Error joining training for {sid}: {str(e)}")
        try:
            db_session.rollback()
        except Exception:
            pass
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
            try:
                db_session.close()
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Error stopping training for {sid}: {str(e)}")
        try:
            db_session.rollback()
        except Exception:
            pass
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

            # IMPORTANT:
            # We cannot use `db_session` inside the background task (it will be closed
            # in the finally block below). Resolve the primitive we need *now*.
            scenario_result = db_session.exec(
                select(Scenarios).where(Scenarios.training_id == chat.training_id)
            ).first()
            rubric_id = scenario_result.rubric_id if scenario_result else None
            logger.info(f"🔧 DEBUG: Resolved rubric_id={rubric_id} for training_id={chat.training_id}")
            
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
                async def _bg_assessment_and_grading(rubric_id):
                    logger.info(f"⚙️ grading background job started (chat_id={chat_id}, rubric_id={rubric_id})")
                    try:
                        def _run_assessment_sync(cid: uuid.UUID):
                            import asyncio as _asyncio

                            return _asyncio.run(run_assessment_agent(cid))
                        await asyncio.to_thread(_run_assessment_sync, uuid.UUID(chat_id))
                    except Exception:
                        logger.exception("Assessment background job failed")
                    try:
                        # Fresh session inside background task
                        def _run_grading_sync(cid: uuid.UUID, rid):
                            import asyncio as _asyncio

                            from app.db import get_session as _gs
                            sess = next(_gs())
                            try:
                                return _asyncio.run(run_grading_agent(cid, rid, sess))
                            finally:
                                sess.close()
                        
                        if rubric_id:
                            rubric_grade_id = await asyncio.to_thread(_run_grading_sync, uuid.UUID(chat_id), rubric_id)
                            sio = get_sio_instance()
                            await sio.emit("grading_completed", {
                                "chat_id": chat_id,
                                "rubric_grade_id": rubric_grade_id,
                                "message": "Grading completed successfully"
                            }, room=chat_id)
                        else:
                            logger.warning(f"⏭️ Skipping grading for chat {chat_id}: no rubric_id")
                            sio = get_sio_instance()
                            await sio.emit("grading_completed", {
                                "chat_id": chat_id,
                                "rubric_grade_id": None,
                                "message": "Skipped grading: no rubric_id"
                            }, room=chat_id)
                    except Exception:
                        logger.exception("Grading background job failed")
                asyncio.create_task(_bg_assessment_and_grading(rubric_id))
                    
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
            try:
                db_session.close()
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Error ending training for {sid}: {str(e)}")
        try:
            db_session.rollback()
        except Exception:
            pass
        await emit_error(sid, f"Failed to end training: {str(e)}")



# Training message handler - routes based on source
async def handle_send_training_message(sid: str, data: Dict[str, Any]) -> None:
    """
    Routes training messages based on source:
    - WebSocket (voice mode OFF): Traditional training flow
    - RTC Data Channel (voice mode ON): Room system with OpenAIAgent
    """
    try:
        chat_id = data.get("chat_id")
        message = (data.get("message") or "").strip()
        if not chat_id or not message:
            await emit_error(sid, "Missing chat_id or message")
            return

        # Check if this is from RTC Data Channel (voice mode ON)
        is_from_rtc = data.get("source") == "rtc"
        
        if is_from_rtc:
            # Voice Mode ON: Use room system with OpenAIAgent
            await handle_training_message_rtc(sid, data)
        else:
            # Voice Mode OFF: Use traditional training flow
            await handle_training_message_websocket(sid, data)
            
    except Exception as e:
        logger.error(f"Error handling training message: {str(e)}")
        await emit_error(sid, f"Failed to process message: {str(e)}")


# Traditional training flow (Voice Mode OFF)
async def handle_training_message_websocket(sid: str, data: Dict[str, Any]) -> None:
    """
    Traditional training path using process_training_message_websocket.
    - Proper persona mapping and database persistence
    - Training message streaming with training_message_* events
    - Support for hints generation
    """
    try:
        chat_id = data.get("chat_id")
        message = (data.get("message") or "").strip()
        
        # Get profile_id from sid for persona mapping
        from app.main import get_profile_id_for_sid
        profile_id = get_profile_id_for_sid(sid)
        
        # Use the traditional training flow
        await process_training_message_websocket(
            chat_id=str(chat_id),
            message=message,
            session=None,  # Let the function create its own session
            profile_id=profile_id
        )
    except Exception as e:
        logger.error(f"Error in traditional training flow: {str(e)}")
        await emit_error(sid, f"Failed to process message: {str(e)}")


# Room system flow (Voice Mode ON)
async def handle_training_message_rtc(sid: str, data: Dict[str, Any]) -> None:
    """
    Room system path using OpenAIAgent.
    - Uses room system with OpenAIAgent
    - Real-time audio processing
    - Different event flow
    """
    try:
        chat_id = data.get("chat_id")
        message = (data.get("message") or "").strip()

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
            except Exception as e:
                logger.error(f"Error getting persona ID: {str(e)}")
                try:
                    db_session.rollback()
                except Exception:
                    pass
            finally:
                try:
                    db_session.close()
                except Exception:
                    pass

        # Use room system with OpenAIAgent
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
        logger.error(f"Error in room system flow: {str(e)}")
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
                "message_id": message_id,   # ★ include
                "success": result.get("success", False),
                "hints": result.get("hints", []),
                "message": result.get("message", "")
            }, room=chat_id)
        except Exception as e:
            logger.exception("Error generating hints (bg)")
            await emit_error(sid, f"Failed to generate hints: {e}")

    # Don't await; schedule and return immediately.
    asyncio.create_task(_bg())

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
                param_ids_iter3 = chat.parameter_ids if chat.parameter_ids is not None else []
                assistant_persona_id = get_persona_id_from_chat(
                    persona_session,
                    str(chat.id),
                    [str(pid) for pid in param_ids_iter3]
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
        
        # Get the scenario for the preamble
        if not chat.scenario_id:
            raise ValueError(f"Chat {chat_id} has no scenario_id")
        
        scenario = db_session.exec(select(Scenarios).where(Scenarios.id == chat.scenario_id)).one_or_none()
        if not scenario:
            raise ValueError(f"Scenario {chat.scenario_id} not found for chat {chat_id}")
        
        preamble = get_preamble(scenario)
        parameter_history = get_parameter_history_simple(chat, db_session)
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

            # Schedule hint generation for this message
            asyncio.create_task(_schedule_hints_for_message(chat_id, str(assistant_message.id)))

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
    async def generate_scenario(sid: str, data: Dict[str, Any]) -> None:
        """Generate a scenario draft (title, problem_statement, objectives[])"""
        try:
            logger.info(f"generate_scenario event triggered for sid={sid}")

            scenario_id = data.get("scenario_id")
            field_values = data.get("field_values", [])
            additional_prompt = (data.get("additional_prompt") or "").strip()

            if not scenario_id:
                await emit_error(sid, "Missing scenario_id")
                return

            db_session = next(get_session())
            try:
                parent = db_session.exec(select(Scenarios).where(Scenarios.id == scenario_id)).one_or_none()
                if not parent:
                    await emit_error(sid, "Scenario not found")
                    return

                # Build parameter history using the new function
                parameter_history = get_parameter_history_from_field_values(field_values, db_session)
                
                preamble = [
                    f"TRAINING: {parent.title}",
                    f"Parent Problem Statement: {(parent.description or '').strip()}",
                ]

                system_prompt = await get_scenario_prompt()
                agent = GenericAgent(
                    agent_name="Scenario Generator",
                    system_prompt=system_prompt,
                    temperature=0.2,
                    output_type=ScenarioResponse,
                )

                # Use a single string input to satisfy strict typing
                param_content = ""
                if parameter_history:
                    param_content = str(parameter_history[0].get("content", ""))
                
                combined = "\n".join([
                    "\n".join(preamble),
                    param_content,
                    additional_prompt or "",
                ]).strip()

                with trace("Scenario"):
                    result = await Runner.run(agent.agent(), input=combined)
                    sr = result.final_output_as(ScenarioResponse)

                sio = get_sio_instance()
                await sio.emit(
                    "scenario_generated",
                    {
                        "success": True,
                        "scenario_id": str(parent.id),
                        "title": sr.title,
                        "problem_statement": sr.problem_statement,
                        "objectives": sr.objectives or [],
                    },
                    room=sid,
                )
            finally:
                try:
                    db_session.close()
                except Exception:
                    pass
        except Exception:
            logger.exception("Error in generate_scenario event")
            await emit_error(sid, "Failed to generate scenario")
    
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
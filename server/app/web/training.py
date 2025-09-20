"""
Training WebSocket handlers for real-time training chat
Simplified version focused on core training functionality
"""

import asyncio
import logging
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, cast

import socketio  # type: ignore
from agents import Runner, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import (Attempts, Chats, Documents,  # ✨ Import Personas
                        Fields, Messages, Parameters, Personas, Rubrics,
                        Scenarios)
from app.services.agents.generic import GenericAgent, run_generic_agent
from app.services.agents.grade import run_grading_agent
from app.services.agents.hint import run_hint_agent
from app.services.agents.scenario import run_scenario_agent
from app.utils.chat import get_conversation_history, get_preamble
from sqlalchemy import Column, text
from sqlmodel import select

logger = logging.getLogger(__name__)

# Global store for active training runs
active_training_runs: Dict[str, Any] = {}

# Short-lived join dedupe map: key=(sid:chat_id) -> last_seen_ts
_recent_joins: Dict[str, float] = {}


async def _schedule_hints_for_message(chat_id: str, message_id: str) -> None:
    """Background hint generation keyed to a specific assistant message."""
    try:
        def _sync(msg_uuid: uuid.UUID) -> Dict[str, Any]:
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
                "low_hints": result.get("dif_low_hints", []),
                "high_hints": result.get("dif_high_hints", []),
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
        # field_values and scenario_draft are deprecated in the simplified flow
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
                training_id=scenario.training_id
            )
            # Optionally set scenario_id if model supports it
            try:
                setattr(chat, "scenario_id", str(scenario.id))
            except Exception:
                pass
            db_session.add(chat)
            db_session.commit()
            db_session.refresh(chat)

            # Document uploads are handled on the frontend before this call
            logger.info("Document uploads completed on frontend")

            # Populate chat.persona_ids, prompts, and max_turns from scenario
            try:
                persona_ids: list[str] = []
                max_turns: dict[str, Optional[int]] = {}
                transformed_prompts: dict[str, str] = {}

                # Get scenario parameter_ids to find persona fields
                conn = db_session.connection()
                row = conn.execute(
                    text("SELECT parameter_ids FROM scenarios WHERE id = :id"),
                    {"id": str(scenario.id)},
                ).fetchone()
                scenario_parameter_ids: list[str] = list(row[0]) if row and row[0] else []

                # Extract persona_ids from scenario parameters
                for pid in scenario_parameter_ids:
                    param = db_session.exec(select(Parameters).where(Parameters.id == pid)).one_or_none()
                    if not param or not param.field_id:
                        continue
                    fld = db_session.exec(select(Fields).where(Fields.id == param.field_id)).one_or_none()
                    if fld and getattr(fld, "field_type", None) == "persona" and param.value:
                        try:
                            persona_id = str(param.value)
                            _ = uuid.UUID(persona_id)  # Validate UUID format
                            persona_ids.append(persona_id)
                            
                            # Get persona to check if it's a user (has profile_id)
                            persona = db_session.exec(select(Personas).where(Personas.id == param.value)).one_or_none()
                            if persona and persona.profile_id:
                                # User persona - infinite turns
                                max_turns[persona_id] = None
                            else:
                                # Assistant persona - 1 turn
                                max_turns[persona_id] = 1
                                
                        except Exception:
                            logger.warning(f"Invalid persona UUID in parameter {param.id}: {param.value}")

                # Ensure the user's persona is included if they have one
                if profile_id:
                    user_persona = db_session.exec(select(Personas).where(Personas.profile_id == profile_id)).one_or_none()
                    if user_persona:
                        user_persona_id_str = str(user_persona.id)
                        if user_persona_id_str not in persona_ids:
                            persona_ids.append(user_persona_id_str)
                            max_turns[user_persona_id_str] = None  # User persona - infinite turns
                            logger.info(f"Added user persona {user_persona.id} for profile {profile_id}")
                        else:
                            logger.info(f"User persona {user_persona.id} already in persona_ids")
                    else:
                        logger.warning(f"No persona found for profile_id {profile_id}")

                logger.info(f"Final persona_ids for chat: {persona_ids}")

                # Transform scenario prompts from alias format to persona_id format
                if hasattr(scenario, 'prompts') and scenario.prompts and hasattr(scenario, 'prompt_mapping') and scenario.prompt_mapping:
                    import json

                    # Create alias to persona name mapping
                    alias_to_persona_name = {}
                    for alias, persona_id in scenario.prompt_mapping.items():
                        persona = db_session.exec(select(Personas).where(Personas.id == persona_id)).one_or_none()
                        if persona:
                            alias_to_persona_name[alias] = persona.name
                    
                    # Transform prompts: alias keys -> persona_id keys, and replace alias references in text
                    for alias, prompt_text in scenario.prompts.items():
                        if alias in scenario.prompt_mapping:
                            persona_id = scenario.prompt_mapping[alias]
                            
                            # Replace alias references in prompt text with persona names
                            transformed_text = prompt_text
                            for ref_alias, persona_name in alias_to_persona_name.items():
                                transformed_text = transformed_text.replace(ref_alias, persona_name)
                            
                            transformed_prompts[persona_id] = transformed_text
                    
                    logger.info(f"Transformed {len(transformed_prompts)} prompts from alias format to persona_id format")

                # Update chat fields via raw SQL
                try:
                    # Set persona_ids
                    if persona_ids:
                        array_sql = "ARRAY[" + ", ".join([f"'{p}'" for p in persona_ids]) + "]::uuid[]"
                    else:
                        array_sql = "NULL"
                    
                    # Set transformed prompts
                    prompts_json = "NULL"
                    if transformed_prompts:
                        import json
                        prompts_json = f"'{json.dumps(transformed_prompts)}'::jsonb"
                    
                    # Set max_turns
                    max_turns_json = "NULL"
                    if max_turns:
                        import json
                        max_turns_json = f"'{json.dumps(max_turns)}'::jsonb"
                    
                    conn.execute(
                        text(f"""
                            UPDATE chats 
                            SET persona_ids = {array_sql},
                                prompts = {prompts_json},
                                max_turns = {max_turns_json}
                            WHERE id = :id
                        """),
                        {"id": str(chat.id)},
                    )
                    db_session.commit()
                    logger.info(f"Updated chat {chat.id} with {len(persona_ids)} personas, {len(transformed_prompts)} prompts, and max_turns: {max_turns}")
                    
                except Exception:
                    logger.exception("Failed to update chat fields")
            except Exception:
                logger.exception("Failed to derive persona_ids from scenario parameters")

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

            # No assessment generation needed - grading will happen at end_training

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

        # Idempotency guard: ignore duplicate joins for same (sid, chat) within 2 seconds
        key = f"{sid}:{chat_id}"
        now = time.time()
        last = _recent_joins.get(key, 0.0)
        if (now - last) < 2.0:
            logger.info(f"Ignoring duplicate join_training within window for sid={sid}, chat_id={chat_id}")
            return
        _recent_joins[key] = now

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

            # Start a corresponding room in audio-multi (id == chat_id) and register this human
            try:
                from app.bridge import get_bridge
                from app.utils.chat import get_audio_config
                bridge = get_bridge(sio)
                # Get dynamic config based on chat_id/room_id
                config = get_audio_config(chat_id)
                await bridge.start_room(room_id=chat_id, config=config)
                human_id = f"user:{profile_id}" if profile_id else f"user:{sid[-6:]}"
                await bridge.register_human(room_id=chat_id, human_id=human_id)
                logger.info(f"Successfully started audio room and registered human {human_id}")
            except Exception as e:
                logger.error(f"Failed to start/register room in audio: {e}")
                logger.exception("failed to start/register room in audio")

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




async def handle_end_training(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle training end requests via WebSocket
    Ends the training session, marks chat as completed, and runs grading
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

            # Get rubric_id for grading using chat.scenario_id
            rubric_id = None
            if chat.scenario_id:
                scenario_result = db_session.exec(
                    select(Scenarios).where(Scenarios.id == chat.scenario_id)
                ).first()
                rubric_id = scenario_result.rubric_id if scenario_result else None
                logger.info(f"🔧 DEBUG: Resolved rubric_id={rubric_id} for scenario_id={chat.scenario_id}")
            else:
                logger.warning(f"🔧 DEBUG: No scenario_id found for chat {chat_id}")
            
            # Run grading in foreground
            sio = get_sio_instance()
            rubric_grade_id = None
            
            if rubric_id:
                logger.info(f"⚙️ Running grading for chat {chat_id} with rubric_id {rubric_id}")
                try:
                    rubric_grade_id = await run_grading_agent(chat_id, rubric_id, db_session)
                    logger.info(f"✅ Grading completed for chat {chat_id}, rubric_grade_id: {rubric_grade_id}")
                except Exception as e:
                    logger.error(f"❌ Grading failed for chat {chat_id}: {str(e)}")
                    rubric_grade_id = None
            else:
                logger.warning(f"⏭️ Skipping grading for chat {chat_id}: no rubric_id")
            
            # Send success response with grading results
            sio.start_background_task(sio.emit,
                "training_ended",
                {
                    "success": True,
                    "chat_id": chat_id,
                    "message": "Training session ended successfully",
                },
                room=chat_id,
            )
            
            # Send grading completed event
            sio.start_background_task(sio.emit,
                "grading_completed",
                {
                    "chat_id": chat_id,
                    "rubric_grade_id": str(rubric_grade_id) if rubric_grade_id else None,
                    "message": "Grading completed successfully" if rubric_grade_id else "Skipped grading: no rubric_id"
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
        
        # Get profile_id from Socket.IO session for clustering safety (fallback to in-memory)
        profile_id = None
        try:
            from app.main import get_profile_id_for_sid, get_socketio_instance
            sio = get_socketio_instance()
            try:
                sess = await sio.get_session(sid)  # type: ignore
            except Exception:
                sess = None
            profile_id = (sess or {}).get("profile_id") if isinstance(sess, dict) else None
            if not profile_id:
                profile_id = get_profile_id_for_sid(sid)
        except Exception:
            pass
        
        # Ensure sender is in the room to receive room-scoped events (no-op if already joined)
        try:
            sio = get_sio_instance()
            await sio.enter_room(sid, str(chat_id))
        except Exception:
            pass
        
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

        from app.store import get_room
        room = get_room(str(chat_id))
        
        # Ensure sender is in the room to receive room-scoped events (no-op if already joined)
        try:
            sio = get_sio_instance()
            await sio.enter_room(sid, str(chat_id))
        except Exception:
            pass

        # Get profile_id from Socket.IO session for clustering safety (fallback to in-memory)
        profile_id = None
        try:
            from app.main import get_profile_id_for_sid, get_socketio_instance
            sio = get_socketio_instance()
            try:
                sess = await sio.get_session(sid)  # type: ignore
            except Exception:
                sess = None
            profile_id = (sess or {}).get("profile_id") if isinstance(sess, dict) else None
            if not profile_id:
                profile_id = get_profile_id_for_sid(sid)
        except Exception:
            pass
        
        # Get user persona_id if available
        persona_id = None
        if profile_id:
            db_session = next(get_session())
            try:
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

        # Use room system with store function
        from app.store import upsert_text_chunk
        await upsert_text_chunk(
            room_id=str(chat_id),
            source_id=sid,     # or profile id
            role="user",
            text=message,
            message_id=None,
            chunk_idx=0,
            is_final=True,
            persona_id=persona_id,
        )

        # Trigger audio service TTS + streaming of user's typed text into the room bus
        try:
            from app.bridge import get_bridge
            sio = get_sio_instance()
            bridge = get_bridge(sio)
            human_id = f"user:{profile_id}" if profile_id else f"user:{sid[-6:]}"
            await bridge.user_text(room_id=str(chat_id), human_id=human_id, text=message)
        except Exception as e:
            logger.error(f"Failed to send user_text to audio for chat {chat_id}: {str(e)}")
    except Exception as e:
        logger.error(f"Error in room system flow: {str(e)}")
        await emit_error(sid, f"Failed to process message: {str(e)}")


# Handler functions for hints
async def handle_get_hints(sid: str, data: Dict[str, Any]) -> None:
    """Handle hints generation without blocking the event loop."""
    chat_id = data.get("chat_id")
    message_id = data.get("message_id")
    if not chat_id or not message_id:
        await emit_error(sid, "Missing chat_id or message_id")
        return

    # Fire a background job in a thread so the main loop stays hot.
    async def _bg() -> None:
        try:
            def _sync_wrapper(msg_id: uuid.UUID) -> Dict[str, Any]:
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
                "low_hints": result.get("dif_low_hints", []),
                "high_hints": result.get("dif_high_hints", []),
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

        # ✨ 3. Get assistant's persona_id from chat.persona_ids (array column)
        assistant_persona_id = None
        try:
            conn = db_session.connection()
            row = conn.execute(
                text("SELECT persona_ids FROM chats WHERE id = :id"),
                {"id": str(chat_id)},
            ).fetchone()
            persona_ids: list[str] = list(row[0]) if row and row[0] else []
            if persona_ids:
                try:
                    assistant_persona_id = uuid.UUID(persona_ids[0])
                except Exception:
                    logger.error(f"Invalid persona id on chat {chat_id}: {persona_ids[0]}")
        except Exception as e:
            logger.error(f"Error reading chat.persona_ids for chat {chat_id}: {str(e)}")
            assistant_persona_id = None
        if not assistant_persona_id:
            logger.error(f"No persona found for chat {chat_id}")
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
        # Build parameter history from scenario.parameter_ids
        try:
            conn = db_session.connection()
            row = conn.execute(
                text("SELECT parameter_ids FROM scenarios WHERE id = :id"),
                {"id": str(scenario.id)},
            ).fetchone()
            scenario_parameter_ids: list[str] = list(row[0]) if row and row[0] else []
        except Exception:
            logger.exception("Failed to load scenario.parameter_ids")
            scenario_parameter_ids = []

        # Build simple parameter lines (mirror utils.get_parameter_history_simple but from scenario ids)
        param_lines: list[str] = []
        try:
            for pid in scenario_parameter_ids:
                param = db_session.exec(select(Parameters).where(Parameters.id == pid)).one_or_none()
                if not param or not param.field_id:
                    continue
                field = db_session.exec(select(Fields).where(Fields.id == param.field_id)).one_or_none()
                if not field:
                    continue
                field_name = field.name or "parameter"
                field_description = field.description or ""
                if getattr(field, "field_type", None) == "persona" and param.value:
                    persona = db_session.exec(select(Personas).where(Personas.id == param.value)).one_or_none()
                    if persona:
                        persona_desc = persona.description if persona.description else "No description available"
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {persona.name}: {persona_desc}")
                    else:
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                elif getattr(field, "field_type", None) == "document" and param.value:
                    document = db_session.exec(select(Documents).where(Documents.id == param.value)).one_or_none()
                    if document:
                        doc_content = document.content if document.content else "No content available"
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is document {str(param.value)[:8]}: {doc_content}")
                    else:
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                elif getattr(field, "field_type", None) == "categorical":
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                else:
                    value = param.value if param.value else param.name
                    if value:
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {value}")
        except Exception:
            logger.exception("Failed building parameter history from scenario parameters")
            param_lines = []

        parameter_history: list[TResponseInputItem] = []
        if param_lines:
            parameter_history = [{
                "role": "user",
                "content": "The following are the parameters for this training session:\n" + "\n".join(param_lines)
            }]
        conversation_history = get_conversation_history(messages)

        # Coerce to the expected TResponseInputItem type for the agent runner
        instructions = cast(list[TResponseInputItem], [preamble] + parameter_history + conversation_history)

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




# Register training event handlers with socketio
def register_training_events(sio: socketio.AsyncServer) -> None:
    """Register training WebSocket event handlers (idempotent)."""
    # Prevent double registration if called more than once
    if getattr(register_training_events, "_registered", False):
        return
    
    @sio.event  # type: ignore
    async def start_training(sid: str, data: Dict[str, Any]) -> None:
        """Start a new training session"""
        logger.info(f"start_training event triggered for sid={sid}")
        await handle_start_training(sid, data)

    @sio.event  # type: ignore
    async def generate_scenario(sid: str, data: Dict[str, Any]) -> None:
        """Generate and persist a child scenario (returns new scenario_id)."""
        try:
            logger.info(f"generate_scenario event triggered for sid={sid}")

            parent_id = data.get("scenario_id")
            field_values = data.get("field_values", [])
            additional_prompt = (data.get("additional_prompt") or "").strip()

            if not parent_id:
                await emit_error(sid, "Missing scenario_id")
                return

            # Get profile_id from WebSocket session
            profile_id = None
            try:
                from app.main import (get_profile_id_for_sid,
                                      get_socketio_instance)
                sio = get_socketio_instance()
                try:
                    sess = await sio.get_session(sid)  # type: ignore
                except Exception:
                    sess = None
                profile_id = (sess or {}).get("profile_id") if isinstance(sess, dict) else None
                if not profile_id:
                    profile_id = get_profile_id_for_sid(sid)
            except Exception:
                logger.warning("Could not get profile_id from session")

            db_session = next(get_session())
            try:
                parent = db_session.exec(select(Scenarios).where(Scenarios.id == parent_id)).one_or_none()
                if not parent:
                    await emit_error(sid, "Scenario not found")
                    return

                # Extract persona_ids from field_values
                persona_ids_from_fields = []
                for fv in field_values:
                    field_id = fv.get("fieldId")
                    parameter_id = fv.get("parameterId")
                    if field_id and parameter_id:
                        # Check if this field is a persona field
                        field = db_session.exec(select(Fields).where(Fields.id == field_id)).one_or_none()
                        if field and getattr(field, "field_type", None) == "persona":
                            # For persona fields, parameter_id points to Parameters record, 
                            # and the actual persona_id is in Parameters.value
                            param = db_session.exec(select(Parameters).where(Parameters.id == parameter_id)).one_or_none()
                            if param and param.value:
                                try:
                                    persona_ids_from_fields.append(uuid.UUID(str(param.value)))
                                    logger.info(f"Added persona_id {param.value} from parameter {parameter_id}")
                                except Exception:
                                    logger.warning(f"Invalid persona UUID in parameter {parameter_id}: {param.value}")

                # Add the user's persona if they have one
                if profile_id:
                    user_persona = db_session.exec(select(Personas).where(Personas.profile_id == profile_id)).one_or_none()
                    if user_persona:
                        if user_persona.id not in persona_ids_from_fields:
                            persona_ids_from_fields.append(user_persona.id)
                            logger.info(f"Added user persona {user_persona.id} for profile {profile_id}")
                        else:
                            logger.info(f"User persona {user_persona.id} already in persona_ids")
                    else:
                        logger.warning(f"No persona found for profile_id {profile_id}")

                logger.info(f"Final persona_ids for scenario generation: {[str(p) for p in persona_ids_from_fields]}")

                # Use the centralized scenario agent - it will handle everything including child scenario creation
                result = await run_scenario_agent(
                    scenario_id=uuid.UUID(parent_id),
                    field_values=field_values,
                    persona_ids=persona_ids_from_fields,
                    additional_context=additional_prompt,
                    create_child=True,
                    session=db_session
                )

                if not result.get("success", False):
                    await emit_error(sid, result.get("message", "Failed to generate scenario"))
                    return

                # Extract results from the scenario agent
                title = result.get("title", "")
                problem_statement = result.get("problem_statement", "")
                objectives = result.get("objectives", [])
                document_ids = result.get("document_ids", [])
                child_scenario_id = result.get("child_scenario_id")


                sio = get_sio_instance()
                await sio.emit(
                    "scenario_generated",
                    {
                        "success": True,
                        "scenario_id": child_scenario_id,
                        "title": title,
                        "problem_statement": problem_statement,
                        "objectives": objectives,
                        "document_ids": document_ids,
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
    async def update_scenario_parameters(sid: str, data: Dict[str, Any]) -> None:
        """Update only scenarios.parameter_ids based on latest field_values (no title/ps/objectives change)."""
        try:
            scenario_id = data.get("scenario_id")
            field_values = data.get("field_values", [])
            if not scenario_id:
                await emit_error(sid, "Missing scenario_id")
                return
            db_session = next(get_session())
            try:
                # Validate scenario exists
                scenario = db_session.exec(select(Scenarios).where(Scenarios.id == scenario_id)).one_or_none()
                if not scenario:
                    await emit_error(sid, "Scenario not found")
                    return

                # Build/collect parameter_ids: reuse provided parameterId, else create
                parameter_ids: list[str] = []
                for fv in field_values:
                    field_id = fv.get("fieldId")
                    value = (fv.get("value") or "").strip()
                    pid = fv.get("parameterId")
                    if pid:
                        parameter_ids.append(str(pid))
                        continue
                    if field_id:
                        try:
                            new_param = Parameters(
                                field_id=field_id,
                                name=value,
                                value=value,
                            )
                            db_session.add(new_param)
                            db_session.commit()
                            db_session.refresh(new_param)
                            parameter_ids.append(str(new_param.id))
                        except Exception:
                            logger.exception("Failed to create parameter from field value")

                # Persist scenarios.parameter_ids via raw SQL
                try:
                    if parameter_ids:
                        array_sql = "ARRAY[" + ", ".join([f"'{p}'" for p in parameter_ids]) + "]::uuid[]"
                    else:
                        array_sql = "NULL"
                    conn = db_session.connection()
                    conn.execute(
                        text(f"UPDATE scenarios SET parameter_ids = {array_sql} WHERE id = :id"),
                        {"id": str(scenario_id)},
                    )
                    db_session.commit()
                except Exception:
                    logger.exception("Failed to update scenarios.parameter_ids in update event")
            finally:
                try:
                    db_session.close()
                except Exception:
                    pass
        except Exception:
            logger.exception("Error in update_scenario_parameters event")
            await emit_error(sid, "Failed to update scenario parameters")
    
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
    async def client_interrupted(sid: str, data: Dict[str, Any]) -> None:
        """Client signals that a message was interrupted on UI at a specific time."""
        try:
            chat_id = data.get("chat_id")
            message_id = data.get("message_id")
            stop_ts_ms = data.get("stop_ts_ms")
            if not chat_id or not message_id or not isinstance(stop_ts_ms, (int, float)):
                return
            from app.db import get_session as _gs
            from sqlalchemy import text as _text
            sess = next(_gs())
            try:
                conn = sess.connection()
                # Fetch created_at to compute relative ms (fit into int4)
                row = conn.execute(
                    _text("SELECT created_at FROM messages WHERE id = :id AND chat_id = :chat_id"),
                    {"id": str(message_id), "chat_id": str(chat_id)},
                ).fetchone()
                if not row:
                    # No row yet → nothing to do
                    return
                # stop_ts_ms is already relative to message start time from client
                # No need to subtract created_at - just use it directly
                rel_ms = max(0, min(int(stop_ts_ms), 2_147_483_647))
                conn.execute(
                    _text(
                        """
                        UPDATE messages
                        SET interruption_ms = :ts
                        WHERE id = :id AND chat_id = :chat_id
                        """
                    ),
                    {"ts": int(rel_ms), "id": str(message_id), "chat_id": str(chat_id)},
                )
                sess.commit()
            except Exception:
                try: sess.rollback()
                except Exception: pass
            finally:
                try: sess.close()
                except Exception: pass
        except Exception:
            logger.exception("client_interrupted handler failed")
    
    logger.info("Successfully registered training WebSocket event handlers")
    register_training_events._registered = True  # type: ignore[attr-defined]


# Utility functions
async def emit_error(sid: str, message: str) -> None:
    """Emit error message to specific socket"""
    sio = get_sio_instance()
    await sio.emit("error", {"message": message}, room=sid)
    logger.error(f"Emitted error to {sid}: {message}")
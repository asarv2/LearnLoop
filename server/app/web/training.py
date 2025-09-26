"""
Training WebSocket handlers for real-time training chat
Simplified version focused on core training functionality
"""

import asyncio
import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any, cast

import socketio  # type: ignore
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import Documents  # ✨ Import Personas
from app.models import (Attempts, Chats, Fields, Messages, Parameters,
                        Personas, Scenarios, Trainings)
from app.room import get_room
from app.services.agents.document import run_document_agent
from app.services.agents.generic import run_generic_agent
from app.services.agents.grade import run_grading_agent
from app.services.agents.hint import run_hint_agent
from app.services.agents.scenario import run_scenario_agent
from app.utils.chat import get_conversation_history, get_preamble
from app.utils.document import (convert_pdf_to_images,
                                get_document_base64_and_content,
                                upload_template_to_supabase_storage)
from openai.types.responses import (EasyInputMessageParam,
                                    ResponseInputImageParam,
                                    ResponseInputMessageContentListParam,
                                    ResponseInputTextParam)
from sqlalchemy import text
from sqlmodel import select

logger = logging.getLogger(__name__)


# Global store for active training runs
active_training_runs: dict[str, Any] = {}


# Short-lived join dedupe map: key=(sid:chat_id) -> last_seen_ts
_recent_joins: dict[str, float] = {}


async def _schedule_hints_for_message(chat_id: str, message_id: str) -> None:
    """Background hint generation keyed to a specific assistant message."""
    try:

        def _sync(msg_uuid: uuid.UUID) -> dict[str, Any]:
            import asyncio as _asyncio

            return _asyncio.run(run_hint_agent(msg_uuid))

        result = await asyncio.to_thread(_sync, uuid.UUID(message_id))
        sio = get_sio_instance()
        await sio.emit(
            "hints_generated",
            {
                "chat_id": chat_id,
                "message_id": message_id,  # ★ add message_id
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


async def handle_start_training(sid: str, data: dict[str, Any]) -> None:
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
                training_id=scenario.training_id,
            )
            # Optionally set scenario_id if model supports it
            try:
                chat.scenario_id = scenario.id
            except Exception:
                pass
            db_session.add(chat)
            db_session.commit()
            db_session.refresh(chat)

            # Document uploads are handled on the frontend before this call
            logger.info("Document uploads completed on frontend")

            # Populate chat.persona_ids, prompts, and max_turns from scenario
            try:
                # Get persona_ids directly from scenario
                persona_ids: list[str] = []
                max_turns: dict[str, int | None] = {}
                transformed_prompts: dict[str, str] = {}

                # Copy persona_ids from scenario
                if hasattr(scenario, "persona_ids") and scenario.persona_ids:
                    persona_ids = [str(pid) for pid in scenario.persona_ids]
                    logger.info(f"Using persona_ids from scenario: {persona_ids}")
                else:
                    logger.warning(f"No persona_ids found in scenario {scenario.id}")

                # Set max_turns based on persona types
                for persona_id_str in persona_ids:
                    try:
                        persona_id = uuid.UUID(persona_id_str)
                        persona = db_session.exec(
                            select(Personas).where(Personas.id == persona_id)
                        ).one_or_none()
                        if persona:
                            if persona.profile_id:
                                # User persona - infinite turns
                                max_turns[persona_id_str] = None
                            else:
                                # Assistant persona - 1 turn
                                max_turns[persona_id_str] = 1
                        else:
                            logger.warning(
                                f"Persona {persona_id_str} not found in database"
                            )
                    except Exception as e:
                        logger.warning(f"Invalid persona UUID {persona_id_str}: {e}")

                # Ensure the user's persona is included if they have one
                if profile_id:
                    user_persona = db_session.exec(
                        select(Personas).where(Personas.profile_id == profile_id)
                    ).one_or_none()
                    if user_persona:
                        user_persona_id_str = str(user_persona.id)
                        if user_persona_id_str not in persona_ids:
                            persona_ids.append(user_persona_id_str)
                            max_turns[user_persona_id_str] = (
                                None  # User persona - infinite turns
                            )
                            logger.info(
                                f"Added user persona {user_persona.id} for profile {profile_id}"
                            )
                        else:
                            logger.info(
                                f"User persona {user_persona.id} already in persona_ids"
                            )
                    else:
                        logger.warning(f"No persona found for profile_id {profile_id}")

                logger.info(f"Final persona_ids for chat: {persona_ids}")

                # Transform scenario prompts from alias format to persona_id format
                if (
                    hasattr(scenario, "prompts")
                    and scenario.prompts
                    and hasattr(scenario, "prompt_mapping")
                    and scenario.prompt_mapping
                ):
                    import json

                    # Create alias to persona name mapping
                    alias_to_persona_name = {}
                    for alias, persona_id in scenario.prompt_mapping.items():
                        persona = db_session.exec(
                            select(Personas).where(Personas.id == persona_id)
                        ).one_or_none()
                        if persona:
                            alias_to_persona_name[alias] = persona.name

                    # Transform prompts: alias keys -> persona_id keys, and replace alias references in text
                    for alias, prompt_text in scenario.prompts.items():
                        if alias in scenario.prompt_mapping:
                            persona_id = scenario.prompt_mapping[alias]

                            # Replace alias references in prompt text with persona names
                            transformed_text = prompt_text
                            for (
                                ref_alias,
                                persona_name,
                            ) in alias_to_persona_name.items():
                                transformed_text = transformed_text.replace(
                                    ref_alias, persona_name
                                )

                            transformed_prompts[str(persona_id)] = transformed_text

                    logger.info(
                        f"Transformed {len(transformed_prompts)} prompts from alias format to persona_id format"
                    )

                # Update chat fields via parameterized query
                try:
                    import json

                    # Prepare data for parameterized query
                    persona_ids_array = persona_ids if persona_ids else []
                    prompts_data = (
                        json.dumps(transformed_prompts) if transformed_prompts else None
                    )
                    max_turns_data = json.dumps(max_turns) if max_turns else None

                    conn = db_session.connection()
                    conn.execute(
                        text("""
                            UPDATE chats 
                            SET persona_ids = :persona_ids,
                                prompts = :prompts,
                                max_turns = :max_turns
                            WHERE id = :id
                        """),
                        {
                            "id": str(chat.id),
                            "persona_ids": persona_ids_array,
                            "prompts": prompts_data,
                            "max_turns": max_turns_data,
                        },
                    )
                    db_session.commit()
                    logger.info(
                        f"Updated chat {chat.id} with {len(persona_ids)} personas, {len(transformed_prompts)} prompts, and max_turns: {max_turns}"
                    )

                except Exception:
                    logger.exception("Failed to update chat fields")
            except Exception:
                logger.exception(
                    "Failed to derive persona_ids from scenario parameters"
                )

            # Skip old scenario agent and initial message

            # Emit started immediately after scenario generation completes
            logger.info(
                f"Successfully created training session: attempt_id={attempt.id}, chat_id={chat.id}"
            )

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


async def handle_join_training(sid: str, data: dict[str, Any]) -> None:
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
            logger.info(
                f"Ignoring duplicate join_training within window for sid={sid}, chat_id={chat_id}"
            )
            return
        _recent_joins[key] = now

        logger.info(
            f"Processing training join: chat_id={chat_id}, profile_id={profile_id}, sid={sid}"
        )

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Get the chat to validate it exists
            result = db_session.exec(select(Chats).where(Chats.id == chat_id))
            chat = result.one_or_none()
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            logger.info(f"Joining training chat {chat_id} for user {profile_id}")

            # Add the user to the chat room
            sio = get_sio_instance()
            await sio.enter_room(sid, chat_id)

            # Start a corresponding room and register this human using room system
            try:
                from app.room import get_room

                room = get_room(chat_id)
                await room.human_join(sid)
                logger.info(
                    f"Successfully started room {chat_id} and registered human {sid}"
                )
            except Exception as e:
                logger.error(f"Failed to start/register room: {e}")
                logger.exception("failed to start/register room")

            # Send success response
            sio.start_background_task(
                sio.emit,
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


async def handle_create_training(sid: str, data: dict[str, Any]) -> None:
    """
    Handle custom training creation requests via WebSocket
    Creates training entry, scenario entry, generates document template, and uploads to Supabase
    """
    try:
        logger.info(f"Received create_training request from {sid} with data: {data}")

        name = data.get("name")
        description = data.get("description")
        document_id = data.get("document_id")  # Optional document ID
        profile_id = data.get("profile_id")

        # New fields for admin-created trainings
        training_type = data.get("training_type", "custom")  # Default to custom
        company = data.get("company")  # Company assignment
        due_date_str = data.get("due_date")  # Due date for required trainings
        admin_created = data.get("admin_created", False)  # Flag for admin creation

        # Parse due_date if provided
        due_date = None
        if due_date_str:
            try:
                from datetime import datetime

                due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
            except Exception as e:
                logger.warning(f"Failed to parse due_date {due_date_str}: {e}")
                due_date = None

        if not name:
            logger.error(f"Missing name in request from {sid}")
            await emit_error(sid, "Missing name")
            return

        if not description:
            logger.error(f"Missing description in request from {sid}")
            await emit_error(sid, "Missing description")
            return

        # Handle empty string profile_id as None for guest mode
        if profile_id == "" or profile_id == "null":
            profile_id = None

        logger.info(
            f"Processing custom training creation: name={name}, description={description}, profile_id={profile_id}, sid={sid}"
        )

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Get profile_id from WebSocket session if not provided
            if not profile_id:
                try:
                    from app.main import (get_profile_id_for_sid,
                                          get_socketio_instance)

                    sio = get_socketio_instance()
                    try:
                        sess = await sio.get_session(sid)  # type: ignore
                    except Exception:
                        sess = None
                    profile_id = (
                        (sess or {}).get("profile_id")
                        if isinstance(sess, dict)
                        else None
                    )
                    if not profile_id:
                        profile_id = get_profile_id_for_sid(sid)
                except Exception:
                    logger.warning("Could not get profile_id from session")

            # Emit progress update: generating training
            sio = get_sio_instance()
            await sio.emit(
                "training_creation_progress",
                {
                    "type": "generating_training",
                    "message": "Creating training entry...",
                    "progress": 25,
                },
                room=sid,
            )

            # Create training entry with specified type (custom or required)
            training = Trainings(
                title=name,
                description=description,
                training_type=training_type,
                user_id=profile_id,
                company=company,
                due_date=due_date,
                active=True,
                practice=False,
                show_documents=True,
            )
            db_session.add(training)
            db_session.commit()
            db_session.refresh(training)

            logger.info(
                f"Created training {training.id} with type {training_type}, company {company}"
            )

            # Emit progress update: generating scenario
            await sio.emit(
                "training_creation_progress",
                {
                    "type": "generating_scenario",
                    "message": "Creating scenario entry...",
                    "progress": 50,
                },
                room=sid,
            )

            # Create scenario entry with the specified group_id
            group_id = uuid.UUID("8b6ed9ac-bfb7-4f31-992b-73935f6560bf")
            scenario = Scenarios(
                title=name,
                description=description,
                training_id=training.id,
                group_ids=[group_id],
                objectives=[],
                parameter_ids=[],
                document_ids=[uuid.UUID(document_id)] if document_id else [],
                prompts={},
                prompt_mapping={},
                persona_ids=[],
                problem_statement="",
            )
            db_session.add(scenario)
            db_session.commit()
            db_session.refresh(scenario)

            logger.info(f"Created scenario {scenario.id} with group_id {group_id}")

            # Emit progress update: generating document
            await sio.emit(
                "training_creation_progress",
                {
                    "type": "generating_document",
                    "message": "Generating document template...",
                    "progress": 75,
                },
                room=sid,
            )

            # Get document as base64 and extract content if document_id is provided
            document_base64 = None
            document_content = ""
            if document_id:
                try:
                    document_data = await get_document_base64_and_content(
                        document_id, db_session
                    )
                    document_base64 = document_data["base64"]
                    document_content = document_data["content"]
                    logger.info(f"Retrieved document {document_id} successfully")
                except Exception as e:
                    logger.error(f"Error retrieving document {document_id}: {e}")
                    # Continue without document

            # Call the document agent to generate template code
            try:
                # Prepare input for document agent with proper typing
                content: ResponseInputMessageContentListParam = []

                # Add content - either images OR text, but not both
                if document_base64:
                    try:
                        # Convert PDF to images
                        logger.info("Converting PDF to images")
                        image_base64_list = convert_pdf_to_images(
                            document_base64
                        )  # Convert all pages

                        if image_base64_list:
                            # Add all pages as images
                            for i, image_base64 in enumerate(image_base64_list):
                                image_item: ResponseInputImageParam = {
                                    "type": "input_image",
                                    "image_url": f"data:image/png;base64,{image_base64}",
                                    "detail": "auto",
                                }
                                content.append(image_item)
                                logger.info(f"Added PDF page {i+1} as image")

                            logger.info(
                                f"Added {len(image_base64_list)} PDF pages as images"
                            )
                        else:
                            logger.warning(
                                "Failed to convert PDF to images, falling back to text content"
                            )
                            # Fall back to text content if image conversion fails
                            if document_content:
                                fallback_text_item_2: ResponseInputTextParam = {
                                    "type": "input_text",
                                    "text": f"Here is the extracted text content from the document:\n\n{document_content}",
                                }
                                content.append(fallback_text_item_2)
                                logger.info("Added text content as fallback")
                    except Exception as e:
                        logger.warning(
                            f"Error processing PDF: {e}, falling back to text content"
                        )
                        # Fall back to text content if image processing fails
                        if document_content:
                            fallback_text_item: ResponseInputTextParam = {
                                "type": "input_text",
                                "text": f"Here is the extracted text content from the document:\n\n{document_content}",
                            }
                            content.append(fallback_text_item)
                            logger.info("Added text content as fallback")
                elif document_content:
                    # No PDF available, use text content
                    no_pdf_text_item: ResponseInputTextParam = {
                        "type": "input_text",
                        "text": f"Here is the extracted text content from the document:\n\n{document_content}",
                    }
                    content.append(no_pdf_text_item)
                    logger.info("Added text content (no PDF available)")

                # Ensure we have at least some content - if both are empty, provide fallback text
                if not content:
                    fallback_text: ResponseInputTextParam = {
                        "type": "input_text",
                        "text": f"Generate a document template for: {name}. Document structure: {description or 'No specific structure provided'}",
                    }
                    content.append(fallback_text)

                # Final validation to ensure content is not empty
                if not content:
                    raise ValueError(
                        "No content available for document generation - both document_base64 and document_content are empty"
                    )

                # Log content summary
                logger.info(
                    f"Prepared {len(content)} content items for document generation"
                )

                input_items: list[EasyInputMessageParam] = [
                    {"role": "user", "content": content}
                ]

                result = await run_document_agent(
                    document_type=name,
                    document_structure=description,  # Use description as fallback
                    context=f"Custom training template for: {name}",
                    input_items=input_items,
                )

                args_code = result.get("args_code", "")
                render_code = result.get("render_code", "")

                if not args_code or not render_code:
                    raise ValueError(
                        "Document agent failed to generate complete template code"
                    )

                # Combine the generated code into a complete template
                template_code = f'''"""
{name} Template Module.

Contract:
- Args: pydantic BaseModel (schema for kwargs)
- render(args: Args) -> bytes  # returns compiled PDF bytes

Optional:
- DEFAULT_FILENAME: str
"""

{args_code}

{render_code}
'''

                logger.info(f"Generated template code for scenario {scenario.id}")

                # Upload template to Supabase Storage
                await upload_template_to_supabase_storage(
                    template_code, str(scenario.id)
                )

                logger.info(
                    f"Successfully uploaded template for scenario {scenario.id}"
                )

            except Exception as e:
                logger.error(f"Error generating document template: {e}")
                await emit_error(sid, f"Failed to generate document template: {str(e)}")
                return

            # Emit completion event
            await sio.emit(
                "training_creation_completed",
                {
                    "success": True,
                    "training_id": str(training.id),
                    "scenario_id": str(scenario.id),
                    "message": "Custom training created successfully",
                    "progress": 100,
                },
                room=sid,
            )

            logger.info(
                f"Successfully created custom training: training_id={training.id}, scenario_id={scenario.id}"
            )

        finally:
            try:
                db_session.close()
            except Exception as close_error:
                logger.error(f"Error closing database session: {str(close_error)}")

    except Exception as e:
        logger.error(f"Error creating custom training for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to create custom training: {str(e)}")


async def handle_end_training(sid: str, data: dict[str, Any]) -> None:
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
            result = db_session.exec(select(Chats).where(Chats.id == chat_id))
            chat = result.one_or_none()
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            # Mark the chat as completed
            chat.completed = True
            chat.completed_at = datetime.now(UTC)
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
                logger.info(
                    f"🔧 DEBUG: Resolved rubric_id={rubric_id} for scenario_id={chat.scenario_id}"
                )
            else:
                logger.warning(f"🔧 DEBUG: No scenario_id found for chat {chat_id}")

            # Run grading in foreground
            sio = get_sio_instance()
            rubric_grade_id = None

            if rubric_id:
                logger.info(
                    f"⚙️ Running grading for chat {chat_id} with rubric_id {rubric_id}"
                )
                try:
                    # Create a fresh session for grading to avoid prepared statement conflicts
                    grading_session = next(get_session())
                    try:
                        rubric_grade_id = await run_grading_agent(
                            chat_id, rubric_id, grading_session
                        )
                    finally:
                        grading_session.close()
                    logger.info(
                        f"✅ Grading completed for chat {chat_id}, rubric_grade_id: {rubric_grade_id}"
                    )
                except Exception as e:
                    logger.error(f"❌ Grading failed for chat {chat_id}: {str(e)}")
                    rubric_grade_id = None
            else:
                logger.warning(f"⏭️ Skipping grading for chat {chat_id}: no rubric_id")

            # Send success response with grading results
            sio.start_background_task(
                sio.emit,
                "training_ended",
                {
                    "success": True,
                    "chat_id": chat_id,
                    "message": "Training session ended successfully",
                },
                room=chat_id,
            )

            # Send grading completed event
            sio.start_background_task(
                sio.emit,
                "grading_completed",
                {
                    "chat_id": chat_id,
                    "rubric_grade_id": str(rubric_grade_id)
                    if rubric_grade_id
                    else None,
                    "message": "Grading completed successfully"
                    if rubric_grade_id
                    else "Skipped grading: no rubric_id",
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
async def handle_send_training_message(sid: str, data: dict[str, Any]) -> None:
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
async def handle_training_message_websocket(sid: str, data: dict[str, Any]) -> None:
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
            profile_id = (
                (sess or {}).get("profile_id") if isinstance(sess, dict) else None
            )
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
            profile_id=profile_id,
            parent_id=data.get("parent_id"),
        )
    except Exception as e:
        logger.error(f"Error in traditional training flow: {str(e)}")
        await emit_error(sid, f"Failed to process message: {str(e)}")


# Room system flow (Voice Mode ON)
async def handle_training_message_rtc(sid: str, data: dict[str, Any]) -> None:
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
            profile_id = (
                (sess or {}).get("profile_id") if isinstance(sess, dict) else None
            )
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

        # Avoid double-creating the user message: let the audio service create and finalize
        # the user message (including transcripts) so a single message id is used end-to-end.
        # If we need persona tagging for user messages later, we can thread it through the
        # audio pipeline explicitly.

        # Get parent_id from client data for branching (if specified)
        parent_id = data.get("parent_id")
        if not parent_id:
            parent_id = room.next_user_parent_id or room.last_assistant_id
        
        # Use room system to append text chunk
        # The room will automatically update its current_parent_id when is_final=True
        user_message_id = await room.append_text_chunk(
            source_id=sid,  # or profile id
            role="user",
            text=message,
            message_id=None,
            chunk_idx=0,
            is_final=True,
            persona_id=persona_id,
            voice=False,  # Always False for text messages
            parent_id=parent_id,  # Use explicit parent_id or room's current_parent_id as fallback
        )
        
        # Update role-specific pointers and consume override
        room.set_last_user(user_message_id)
        room.set_next_user_parent(None)
    except Exception as e:
        logger.error(f"Error in room system flow: {str(e)}")
        await emit_error(sid, f"Failed to process message: {str(e)}")


# Handler functions for hints
async def handle_get_hints(sid: str, data: dict[str, Any]) -> None:
    """Handle hints generation without blocking the event loop."""
    chat_id = data.get("chat_id")
    message_id = data.get("message_id")
    if not chat_id or not message_id:
        await emit_error(sid, "Missing chat_id or message_id")
        return

    # Fire a background job in a thread so the main loop stays hot.
    async def _bg() -> None:
        try:

            def _sync_wrapper(msg_id: uuid.UUID) -> dict[str, Any]:
                # Run the async hint routine on a dedicated loop in this worker thread
                import asyncio as _asyncio

                return _asyncio.run(run_hint_agent(msg_id))

            result = await asyncio.to_thread(_sync_wrapper, uuid.UUID(message_id))

            sio = get_sio_instance()
            await sio.emit(
                "hints_generated",
                {
                    "chat_id": chat_id,
                    "message_id": message_id,  # ★ include
                    "success": result.get("success", False),
                    "hints": result.get("hints", []),
                    "low_hints": result.get("dif_low_hints", []),
                    "high_hints": result.get("dif_high_hints", []),
                    "message": result.get("message", ""),
                },
                room=chat_id,
            )
        except Exception as e:
            logger.exception("Error generating hints (bg)")
            await emit_error(sid, f"Failed to generate hints: {e}")

    # Don't await; schedule and return immediately.
    asyncio.create_task(_bg())


async def process_training_message_websocket(
    chat_id: str,
    message: str = "",
    session: Any | None = None,
    profile_id: str | None = None,
    parent_id: str | None = None,
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
        result = db_session.exec(select(Chats).where(Chats.id == chat_id))
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

        # Set the parent_id on the room for this turn if provided (branching)
        if parent_id:
            room = get_room(chat_id)
            room.set_parent_id(parent_id)

        # Create user message; link to provided parent (previous assistant or start)
        user_message = Messages(
            chat_id=chat_id,
            content=message,
            role="user",
            training_id=chat.training_id,
            completed=True,
            persona_id=user_persona_id,
            parent_id=parent_id,
            voice=False,  # Always False for text messages
        )
        db_session.add(user_message)
        db_session.commit()
        db_session.refresh(user_message)

        logger.info(f"Created user message {user_message.id} for chat {chat_id}")

        # Immediately confirm to the client that the user message was saved
        sio = get_sio_instance()
        await sio.emit(
            "user_message_saved",
            {
                "chat_id": chat_id,
                # ✨ 2. Enrich the message payload with the persona_id and parent_id
                "message": {
                    "id": str(user_message.id),
                    "chat_id": str(user_message.chat_id),
                    "content": user_message.content,
                    "role": user_message.role,
                    "persona_id": str(user_persona_id)
                    if user_persona_id
                    else None,  # Add persona_id
                    "parent_id": str(user_message.parent_id)
                    if user_message.parent_id
                    else None,  # Add parent_id for retry functionality
                    "voice": user_message.voice,  # Add voice flag for retry functionality
                    "completed": user_message.completed,
                    "created_at": user_message.created_at.isoformat(),
                    "completed_at": user_message.completed_at.isoformat()
                    if user_message.completed_at
                    else None,
                },
            },
            room=chat_id,
        )

        # Advance the server-managed parent cursor to the new user message
        try:
            room = get_room(chat_id)
            room.set_parent_id(str(user_message.id))
        except Exception:
            pass

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
                    logger.error(
                        f"Invalid persona id on chat {chat_id}: {persona_ids[0]}"
                    )
        except Exception as e:
            logger.error(f"Error reading chat.persona_ids for chat {chat_id}: {str(e)}")
            assistant_persona_id = None
        if not assistant_persona_id:
            logger.error(f"No persona found for chat {chat_id}")
            return


        # Create assistant message placeholder, linked to the user message
        assistant_message = Messages(
            chat_id=chat_id,
            content="",
            role="assistant",
            training_id=chat.training_id,
            completed=False,
            persona_id=assistant_persona_id,
            parent_id=user_message.id,
        )
        db_session.add(assistant_message)
        db_session.commit()
        db_session.refresh(assistant_message)

        # ✨ 4. Emit message start event with the assistant's persona_id
        parent_id_str = str(assistant_message.parent_id) if assistant_message.parent_id else None
        logger.info(f"🔍 Server emitting training_message_start: parent_id={parent_id_str}, assistant_id={assistant_message.id}")
        await sio.emit(
            "training_message_start",
            {
                "chat_id": chat_id,
                "message_id": str(assistant_message.id),
                "persona_id": str(assistant_persona_id),  # Add persona_id
                # Include assistant parent for correct client-side threading
                "parent_id": parent_id_str,
            },
            room=chat_id,
        )

        # Get conversation history
        messages = db_session.exec(
            select(Messages).where(Messages.chat_id == chat_id)
        ).all()

        # Get the scenario for the preamble
        if not chat.scenario_id:
            raise ValueError(f"Chat {chat_id} has no scenario_id")

        scenario = db_session.exec(
            select(Scenarios).where(Scenarios.id == chat.scenario_id)
        ).one_or_none()
        if not scenario:
            raise ValueError(
                f"Scenario {chat.scenario_id} not found for chat {chat_id}"
            )

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
                param = db_session.exec(
                    select(Parameters).where(Parameters.id == pid)
                ).one_or_none()
                if not param or not param.field_id:
                    continue
                field = db_session.exec(
                    select(Fields).where(Fields.id == param.field_id)
                ).one_or_none()
                if not field:
                    continue
                field_name = field.name or "parameter"
                field_description = field.description or ""
                if getattr(field, "field_type", None) == "persona" and param.value:
                    persona = db_session.exec(
                        select(Personas).where(Personas.id == param.value)
                    ).one_or_none()
                    if persona:
                        persona_desc = (
                            persona.description
                            if persona.description
                            else "No description available"
                        )
                        param_lines.append(
                            f"The {field_name} ({field_description}) for this chat is {persona.name}: {persona_desc}"
                        )
                    else:
                        param_lines.append(
                            f"The {field_name} ({field_description}) for this chat is {param.name}"
                        )
                elif getattr(field, "field_type", None) == "document" and param.value:
                    document = db_session.exec(
                        select(Documents).where(Documents.id == param.value)
                    ).one_or_none()
                    if document:
                        doc_content = (
                            document.content
                            if document.content
                            else "No content available"
                        )
                        param_lines.append(
                            f"The {field_name} ({field_description}) for this chat is document {str(param.value)[:8]}: {doc_content}"
                        )
                    else:
                        param_lines.append(
                            f"The {field_name} ({field_description}) for this chat is {param.name}"
                        )
                elif getattr(field, "field_type", None) == "categorical":
                    param_lines.append(
                        f"The {field_name} ({field_description}) for this chat is {param.name}"
                    )
                else:
                    value = param.value if param.value else param.name
                    if value:
                        param_lines.append(
                            f"The {field_name} ({field_description}) for this chat is {value}"
                        )
        except Exception:
            logger.exception(
                "Failed building parameter history from scenario parameters"
            )
            param_lines = []

        parameter_history: list[TResponseInputItem] = []
        if param_lines:
            parameter_history = [
                {
                    "role": "user",
                    "content": "The following are the parameters for this training session:\n"
                    + "\n".join(param_lines),
                }
            ]
        conversation_history = get_conversation_history(messages)

        # Coerce to the expected TResponseInputItem type for the agent runner
        instructions = cast(
            list[TResponseInputItem],
            [preamble] + parameter_history + conversation_history,
        )

        # Stream response using generic agent
        accumulated_content = ""
        try:
            # The agent run uses the persona_id already, which is great
            async for chunk in run_generic_agent(
                assistant_persona_id, instructions, db_session
            ):
                accumulated_content += chunk

                # Emit token update
                await sio.emit(
                    "training_message_token",
                    {
                        "chat_id": chat_id,
                        "message_id": str(assistant_message.id),
                        "token": chunk,
                        "accumulated_content": accumulated_content,
                    },
                    room=chat_id,
                )

            # Update message with final content
            assistant_message.content = accumulated_content
            assistant_message.completed = True
            db_session.add(assistant_message)
            db_session.commit()

            # Emit completion
            await sio.emit(
                "training_message_complete",
                {
                    "chat_id": chat_id,
                    "message_id": str(assistant_message.id),
                    "final_content": accumulated_content,
                # Include parent_id on completion as well (belt-and-suspenders)
                "parent_id": str(assistant_message.parent_id)
                if assistant_message.parent_id
                else None,
                },
                room=chat_id,
            )

            logger.info(
                f"Completed training message {assistant_message.id} for chat {chat_id}"
            )

            # Schedule hint generation for this message
            asyncio.create_task(
                _schedule_hints_for_message(chat_id, str(assistant_message.id))
            )

            # Advance the server-managed parent cursor to the assistant message
            try:
                room = get_room(chat_id)
                room.set_parent_id(str(assistant_message.id))
            except Exception:
                pass

        except Exception as e:
            logger.error(f"Error generating training response: {str(e)}")

            # Mark message as error and emit error event
            assistant_message.error = str(e)
            assistant_message.completed = True
            db_session.add(assistant_message)
            db_session.commit()

            await sio.emit(
                "training_message_error",
                {
                    "chat_id": chat_id,
                    "message_id": str(assistant_message.id),
                    "error": str(e),
                },
                room=chat_id,
            )

            # Even on error, advance cursor to assistant message id for consistent threading
            try:
                room = get_room(chat_id)
                room.set_parent_id(str(assistant_message.id))
            except Exception:
                pass

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
    async def start_training(sid: str, data: dict[str, Any]) -> None:
        """Start a new training session"""
        logger.info(f"start_training event triggered for sid={sid}")
        await handle_start_training(sid, data)

    @sio.event  # type: ignore
    async def generate_scenario(sid: str, data: dict[str, Any]) -> None:
        """Generate and persist a child scenario (returns new scenario_id)."""
        try:
            logger.info(f"generate_scenario event triggered for sid={sid}")

            parent_id = data.get("scenario_id")
            field_values = data.get("field_values", [])
            persona_ids_from_payload = data.get("persona_ids", [])
            additional_prompt = (data.get("additional_prompt") or "").strip()
            generate_documents = data.get("generate_documents", True)

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
                profile_id = (
                    (sess or {}).get("profile_id") if isinstance(sess, dict) else None
                )
                if not profile_id:
                    profile_id = get_profile_id_for_sid(sid)
            except Exception:
                logger.warning("Could not get profile_id from session")

            db_session = next(get_session())
            try:
                parent = db_session.exec(
                    select(Scenarios).where(Scenarios.id == parent_id)
                ).one_or_none()
                if not parent:
                    await emit_error(sid, "Scenario not found")
                    return

                # Use persona_ids from payload (sent from frontend)
                persona_ids_from_payload_uuids = []
                if persona_ids_from_payload:
                    try:
                        persona_ids_from_payload_uuids = [
                            uuid.UUID(pid) for pid in persona_ids_from_payload
                        ]
                        logger.info(
                            f"Using persona_ids from payload: {[str(p) for p in persona_ids_from_payload_uuids]}"
                        )
                    except Exception as e:
                        logger.warning(f"Error parsing persona_ids from payload: {e}")

                # If no persona_ids in payload, fall back to extracting from field_values
                if not persona_ids_from_payload_uuids:
                    logger.info(
                        "No persona_ids in payload, extracting from field_values"
                    )
                    for fv in field_values:
                        field_id = fv.get("fieldId")
                        parameter_id = fv.get("parameterId")
                        if field_id and parameter_id:
                            # Check if this field is a persona field
                            field = db_session.exec(
                                select(Fields).where(Fields.id == field_id)
                            ).one_or_none()
                            if (
                                field
                                and getattr(field, "field_type", None) == "persona"
                            ):
                                # For persona fields, parameter_id points to Parameters record,
                                # and the actual persona_id is in Parameters.value
                                param = db_session.exec(
                                    select(Parameters).where(
                                        Parameters.id == parameter_id
                                    )
                                ).one_or_none()
                                if param and param.value:
                                    try:
                                        persona_ids_from_payload_uuids.append(
                                            uuid.UUID(str(param.value))
                                        )
                                        logger.info(
                                            f"Added persona_id {param.value} from parameter {parameter_id}"
                                        )
                                    except Exception:
                                        logger.warning(
                                            f"Invalid persona UUID in parameter {parameter_id}: {param.value}"
                                        )

                # Add the user's persona if they have one and not already included
                if profile_id:
                    user_persona = db_session.exec(
                        select(Personas).where(Personas.profile_id == profile_id)
                    ).one_or_none()
                    if user_persona:
                        if user_persona.id not in persona_ids_from_payload_uuids:
                            persona_ids_from_payload_uuids.append(user_persona.id)
                            logger.info(
                                f"Added user persona {user_persona.id} for profile {profile_id}"
                            )
                        else:
                            logger.info(
                                f"User persona {user_persona.id} already in persona_ids"
                            )
                    else:
                        logger.warning(f"No persona found for profile_id {profile_id}")

                logger.info(
                    f"Final persona_ids for scenario generation: {[str(p) for p in persona_ids_from_payload_uuids]}"
                )

                # Use the centralized scenario agent - it will handle everything including child scenario creation
                result = await run_scenario_agent(
                    scenario_id=uuid.UUID(parent_id),
                    field_values=field_values,
                    persona_ids=persona_ids_from_payload_uuids,
                    additional_context=additional_prompt,
                    create_child=True,
                    session=db_session,
                    generate_documents=generate_documents,
                )

                if not result.get("success", False):
                    error_message = result.get("message", "Failed to generate scenario")
                    logger.error(
                        f"Scenario generation failed for {parent_id}: {error_message}"
                    )
                    await emit_error(sid, error_message)
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
        except Exception as e:
            logger.exception("Error in generate_scenario event")
            error_message = f"Scenario generation failed: {str(e)}"
            await emit_error(sid, error_message)

    @sio.event  # type: ignore
    async def update_scenario_parameters(sid: str, data: dict[str, Any]) -> None:
        """Update only scenarios.parameter_ids based on latest field_values (no title/ps/objectives change)."""
        try:
            scenario_id = data.get("scenario_id")
            field_values = data.get("field_values", [])
            persona_ids = data.get("persona_ids", [])
            if not scenario_id:
                await emit_error(sid, "Missing scenario_id")
                return
            db_session = next(get_session())
            try:
                # Validate scenario exists
                scenario = db_session.exec(
                    select(Scenarios).where(Scenarios.id == scenario_id)
                ).one_or_none()
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
                            logger.exception(
                                "Failed to create parameter from field value"
                            )

                # Persist scenarios.parameter_ids via raw SQL
                try:
                    if parameter_ids:
                        array_sql = (
                            "ARRAY["
                            + ", ".join([f"'{p}'" for p in parameter_ids])
                            + "]::uuid[]"
                        )
                    else:
                        array_sql = "ARRAY[]::uuid[]"  # Empty array instead of NULL
                    conn = db_session.connection()
                    conn.execute(
                        text(
                            f"UPDATE scenarios SET parameter_ids = {array_sql} WHERE id = :id"
                        ),
                        {"id": str(scenario_id)},
                    )
                    db_session.commit()
                except Exception:
                    logger.exception(
                        "Failed to update scenarios.parameter_ids in update event"
                    )
            finally:
                try:
                    db_session.close()
                except Exception:
                    pass
        except Exception:
            logger.exception("Error in update_scenario_parameters event")
            await emit_error(sid, "Failed to update scenario parameters")

    @sio.event  # type: ignore
    async def join_training(sid: str, data: dict[str, Any]) -> None:
        """Join a training chat room"""
        logger.info(f"join_training event triggered for sid={sid}")
        await handle_join_training(sid, data)

    @sio.event  # type: ignore
    async def set_parent_cursor(sid: str, data: dict[str, Any]) -> None:
        """Explicitly set the server parent cursor for a chat (branching)."""
        try:
            chat_id = data.get("chat_id")
            parent_id = data.get("parent_id")
            if not chat_id:
                await emit_error(sid, "Missing chat_id")
                return
            room = get_room(str(chat_id))
            room.set_parent_id(str(parent_id) if parent_id else None)
            await sio.emit(
                "parent_cursor_set",
                {"chat_id": str(chat_id), "parent_id": parent_id or None},
                room=sid,
            )
        except Exception as e:
            logger.exception("Failed to set parent cursor")
            await emit_error(sid, f"Failed to set parent cursor: {e}")

    @sio.event  # type: ignore
    async def send_training_message(sid: str, data: dict[str, Any]) -> None:
        """Send a training message"""
        logger.info(f"send_training_message event triggered for sid={sid}")
        await handle_send_training_message(sid, data)

    @sio.event  # type: ignore
    async def end_training(sid: str, data: dict[str, Any]) -> None:
        """End training session"""
        logger.info(f"end_training event triggered for sid={sid}")
        await handle_end_training(sid, data)

    @sio.event  # type: ignore
    async def get_hints(sid: str, data: dict[str, Any]) -> None:
        """Get hints for a message"""
        logger.info(f"get_hints event triggered for sid={sid}")
        await handle_get_hints(sid, data)

    @sio.event  # type: ignore
    async def create_training(sid: str, data: dict[str, Any]) -> None:
        """Create a custom training with document template generation"""
        logger.info(f"create_training event triggered for sid={sid}")
        await handle_create_training(sid, data)

    @sio.event  # type: ignore
    async def client_interrupted(sid: str, data: dict[str, Any]) -> None:
        """Client signals that a message was interrupted on UI at a specific time."""
        try:
            chat_id = data.get("chat_id")
            message_id = data.get("message_id")
            stop_ts_ms = data.get("stop_ts_ms")
            if (
                not chat_id
                or not message_id
                or not isinstance(stop_ts_ms, (int, float))
            ):
                return
            from app.db import get_session as _gs
            from sqlalchemy import text as _text

            sess = next(_gs())
            try:
                conn = sess.connection()
                # Fetch created_at to compute relative ms (fit into int4)
                row = conn.execute(
                    _text(
                        "SELECT created_at FROM messages WHERE id = :id AND chat_id = :chat_id"
                    ),
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
                try:
                    sess.rollback()
                except Exception:
                    pass
            finally:
                try:
                    sess.close()
                except Exception:
                    pass
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

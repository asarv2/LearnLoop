import logging
import random
import uuid
from typing import List, Optional, Sequence

from agents.items import TResponseInputItem
from agents.realtime.items import (AssistantMessageItem, AssistantText,
                                   InputText, UserMessageItem)
from agents.realtime.model_events import RealtimeItem
from app.db import get_session, reset_connection_pool
from app.models import (Assessments, Chats, Documents, Fields, Messages,
                        Parameters, Personas, Questions, Rubrics, Scenarios,
                        Standards)
from sqlmodel import Session, select

logger = logging.getLogger(__name__)
def get_preamble(
    scenario: Scenarios
) -> TResponseInputItem:
    """
    Create a user message with the scenario's title, problem statement, and objectives.
    """
    title = scenario.title
    problem_statement = scenario.problem_statement or "No problem statement provided"
    objectives = scenario.objectives or []
    
    # Format objectives as a bulleted list
    objectives_text = ""
    if objectives:
        objectives_text = "\nObjectives:\n" + "\n".join(f"• {obj}" for obj in objectives)
    
    content = f"{title}\n\nProblem Statement: {problem_statement}{objectives_text}\n\nThe following is the current history of the conversation. Continue the conversation from this point on:"
    return {
        "role": "user",
        "content": content
    }

def get_conversation_history(
    messages: Sequence[Messages],
) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages.

    Args:
        messages: List of Messages objects from the database

    Returns:
        List of message objects formatted for OpenAI API consumption
    """
    conversation_history: list[TResponseInputItem] = []

    # Sort messages by created_at
    sorted_messages = sorted(messages, key=lambda x: x.created_at)

    for message in sorted_messages:
        if message.role == "user" and message.content:
            user_message_item: TResponseInputItem = {
                "role": "user",
                "content": message.content,
            }
            conversation_history.append(user_message_item)
        elif message.role == "assistant" and message.content:
            assistant_message_item: TResponseInputItem = {
                "role": "assistant",
                "content": message.content,
            }
            conversation_history.append(assistant_message_item)

    logger.info(
        f"Generated conversation history with {len(conversation_history)} messages"
    )

    return conversation_history
def get_dynamic_rubric(
    rubric: Rubrics,
    standards: List[Standards],
) -> TResponseInputItem:
    """
    Build a dynamic rubric from database objects.

    Args:
        rubric: The rubric object from database
        standards: List of standards for this rubric

    Returns:
        Dynamic rubric formatted for agent consumption
    """
    rubric_lines = [
        f"RUBRIC: {rubric.name}",
        f"Description: {rubric.description}",
        f"Total Points: {rubric.total_points}",
        "",
        "EVALUATION CRITERIA:",
        "",
    ]

    # Sort standards by name for consistent ordering
    sorted_standards = sorted(standards, key=lambda x: x.name)

    # Build criteria sections
    for standard in sorted_standards:
        rubric_lines.extend([
            f"CRITERION: {standard.name}",
            f"Description: {standard.description}",
            "Rating Scale:",
        ])

        # Add items if they exist
        if standard.items:
            for item in standard.items:
                rubric_lines.append(f"  - {item}")
        else:
            # Default 1-5 scale if no specific items
            rubric_lines.extend([
                "  5 - Excellent: Outstanding performance",
                "  4 - Good: Above average performance", 
                "  3 - Average: Adequate performance",
                "  2 - Below Average: Needs improvement",
                "  1 - Poor: Unsatisfactory performance"
            ])

        rubric_lines.append("")  # Empty line between criteria

    rubric_string = "\n".join(rubric_lines)

    return {
        "role": "user",
        "content": f"You are evaluating a conversation based on the following rubric. Please provide scores (1-5) and feedback for each criterion.\n\n{rubric_string}",
    }

def get_parameter_history_from_field_values(
    field_values: List[dict],
    session: Session,
) -> list[TResponseInputItem]:
    """
    Get parameter history directly from field_values (like in generate_scenario).
    This is a simpler approach that builds parameter lines directly from the field values
    rather than going through the complex parameter/field lookup process.
    
    Args:
        field_values: List of field value dictionaries with fieldId, value, parameterId
        session: Database session for lookups
        
    Returns:
        List of parameter messages formatted for agent consumption
    """
    if not field_values:
        return []
    
    # Use a fresh session for this operation to avoid prepared statement conflicts
    fresh_session = next(get_session())
    try:
        param_lines: list[str] = []
        
        for fv in field_values:
            field_id = fv.get("fieldId")
            value = fv.get("value", "").strip()
            parameter_id = fv.get("parameterId")
            
            if not field_id:
                continue
                
            # Get the field to understand its type and name
            field = fresh_session.exec(select(Fields).where(Fields.id == field_id)).one_or_none()
            if not field:
                continue
                
            field_name = field.name or "parameter"
            field_description = field.description or ""
            
            # Handle different field types
            if field.field_type == 'persona' and parameter_id:
                # For persona fields, the field_values carry a parameterId that points to Parameters;
                # resolve the underlying Persona via Parameters.value
                from app.models import Parameters as _Parameters
                from app.models import Personas
                param_row = fresh_session.exec(select(_Parameters).where(_Parameters.id == parameter_id)).one_or_none()
                persona = None
                if param_row and param_row.value:
                    try:
                        persona = fresh_session.exec(select(Personas).where(Personas.id == param_row.value)).one_or_none()
                    except Exception:
                        persona = None
                if persona:
                    persona_desc = persona.description if persona.description else "No description available"
                    # Include parameter description (useful metadata) after the name
                    param_desc = None
                    if param_row and getattr(param_row, "description", None):
                        param_desc = param_row.description  # type: ignore[assignment]
                    param_desc_part = f" ({param_desc})" if param_desc else ""
                    param_lines.append(
                        f"The {field_name} ({field_description}) for this chat is {persona.name}{param_desc_part}: {persona_desc}"
                    )
                else:
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {value}")
                    
            elif field.field_type == 'document':
                # For document fields, prefer the explicit value (document id) from field_values;
                # if missing, fall back to resolving via parameterId → Parameters.value
                doc_id = value
                if not doc_id and parameter_id:
                    from app.models import Parameters as _Parameters
                    param_row = fresh_session.exec(select(_Parameters).where(_Parameters.id == parameter_id)).one_or_none()
                    if param_row and param_row.value:
                        doc_id = param_row.value
                if doc_id:
                    document = fresh_session.exec(select(Documents).where(Documents.id == doc_id)).one_or_none()
                    if document:
                        doc_content = document.content if document.content else "No content available"
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is document {str(doc_id)[:8]}: {doc_content}")
                    else:
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {doc_id}")
                    
            elif field.field_type == 'categorical' and parameter_id:
                # For categorical fields, use the parameter name
                param = fresh_session.exec(select(Parameters).where(Parameters.id == parameter_id)).one_or_none()
                if param:
                    desc_part = f" ({param.description})" if getattr(param, "description", None) else ""
                    param_lines.append(
                        f"The {field_name} ({field_description}) for this chat is {param.name}{desc_part}"
                    )
                else:
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {value}")
                    
            else:
                # For text, numerical, or other fields, use the value directly
                if value:
                    # If a backing parameter exists, include its description for extra context
                    desc_part = ""
                    if parameter_id:
                        from app.models import Parameters as _Parameters
                        maybe_param = fresh_session.exec(select(_Parameters).where(_Parameters.id == parameter_id)).one_or_none()
                        if maybe_param and getattr(maybe_param, "description", None):
                            desc_part = f" ({maybe_param.description})"
                    param_lines.append(
                        f"The {field_name} ({field_description}) for this chat is {value}{desc_part}"
                    )
        
        # Return as a single user message with all parameters
        if param_lines:
            content = "\n".join(param_lines)
            return [{
                "role": "developer",
                "content": f"The following are the parameters for this training session:\n{content}"
            }]
        
        return []
        
    except Exception as e:
        logger.error(f"Error building parameter history from field values: {e}")
        return []
    finally:
        fresh_session.close()
def get_audio_config(chat_id: str) -> dict:
    """
    Generate audio bridge configuration for a given chat_id.
    
    Args:
        chat_id: The UUID string of the chat
        
    Returns:
        Dictionary containing the audio bridge configuration
    """
    try:
        # Use a fresh session for this operation
        fresh_session = next(get_session())
        try:
            # Get the chat object
            chat = fresh_session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
            if not chat:
                logger.warning(f"Chat {chat_id} not found, using default config")
                return _get_default_audio_config()
            
            # Get the scenario object
            scenario = None
            if chat.scenario_id:
                scenario = fresh_session.exec(select(Scenarios).where(Scenarios.id == chat.scenario_id)).one_or_none()
            
            # Build the base configuration from chat object
            config = {
                "idle_timeout": chat.idle_timeout or 30,
                "require_users": getattr(chat, 'require_users', True),  # Use chat attribute, default to True
                "max_turns": chat.max_turns or {},
                "prompts": chat.prompts or {},
                "persona_mappings": chat.persona_mapping or {},
                "persona_ids": [str(pid) for pid in (chat.persona_ids or [])],
            }
            
            # Add scenario data if available
            if scenario:
                config.update({
                    "name": scenario.title,
                    "problem_statement": scenario.problem_statement,
                    "objectives": scenario.objectives or [],
                })
            else:
                config.update({
                    "name": None,
                    "problem_statement": None,
                    "objectives": [],
                })
            
            # Build agents from persona_ids
            agents = []
            if chat.persona_ids:
                for persona_id in chat.persona_ids:
                    persona = fresh_session.exec(select(Personas).where(Personas.id == persona_id)).one_or_none()
                    if persona:
                        # Determine if this is a user or agent based on profile_id
                        is_user = persona.profile_id is not None
                        prefix = "user" if is_user else "agent"
                        
                        agent = {
                            "id": f"{prefix}:{persona.name}",
                            "name": persona.name,
                            "description": persona.description or "",
                            "voice": persona.voice,
                            "profile_id": str(persona.profile_id) if persona.profile_id else None,
                            "user": is_user,
                        }
                        agents.append(agent)
            
            config["agents"] = agents
            
            # Add enable_word_timestamps (default to True as per current implementation)
            config["enable_word_timestamps"] = True
            
            logger.info(f"Generated audio config for chat {chat_id} with {len(agents)} agents")
            return config
            
        finally:
            fresh_session.close()
            
    except Exception as e:
        logger.error(f"Error generating audio config for chat {chat_id}: {e}")
        return _get_default_audio_config()
def _get_default_audio_config() -> dict:
    """
    Return the default audio configuration as fallback.
    """
    return {
        "require_users": True,
        "enable_word_timestamps": True,
        "name": None,
        "problem_statement": None,
        "objectives": [],
        "idle_timeout": 30,
        "max_turns": {},
        "prompts": {},
        "persona_mappings": {},
        "persona_ids": [],
        "agents": [],
    }
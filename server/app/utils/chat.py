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
                        Parameters, Personas, Questions, Rubrics, Standards)
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_preamble(
    chat: Chats
) -> TResponseInputItem:
    """
    Create a user message with the chat's description and name.
    """
    title = getattr(chat, "title", None) or getattr(chat, "title", "")
    description = getattr(chat, "description", None)
    content = f"{title}\nDescription: {description}. The following is the current history of the conversation. Continue the conversation from this point on:"
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


def get_parameter_history(
    chat: Chats,
    session: Session,
) -> list[TResponseInputItem]:
    """
    Get the parameter history for a given chat.
    """
    # Find the chat and get its parameter_ids
    if not chat.parameter_ids:
        return []
    
    # Use a fresh session for this operation to avoid prepared statement conflicts
    fresh_session = next(get_session())
    try:
        # Fetch all Parameters individually to avoid linter issues with UUID.in_()
        all_parameters = []
        for param_id in chat.parameter_ids:
            param = fresh_session.exec(select(Parameters).where(Parameters.id == param_id)).one_or_none()
            if param:
                all_parameters.append(param)
        
        # Get all field IDs to fetch fields efficiently
        field_ids = [param.field_id for param in all_parameters if param.field_id]

        # Fetch all fields with a single query using string conversion to avoid UUID.in_() issues
        all_fields: list[Fields] = []
        if field_ids:
            # Use individual queries but with a fresh session to avoid prepared statement issues
            for field_id in field_ids:
                field = fresh_session.exec(select(Fields).where(Fields.id == field_id)).one_or_none()
                if field:
                    all_fields.append(field)
        
        # Create a mapping of field_id to field for quick lookup
        field_map = {field.id: field for field in all_fields}
        
        # Get all document IDs for document-type fields
        document_ids = []
        persona_ids = []
        for param in all_parameters:
            if param.field_id and param.field_id in field_map:
                field = field_map[param.field_id]
                if field.field_type == 'document' and param.value:
                    document_ids.append(param.value)
                elif field.field_type == 'persona' and param.value:
                    persona_ids.append(param.value)
        
        # Fetch all documents individually with fresh session
        all_documents = {}
        for doc_id in document_ids:
            document = fresh_session.exec(select(Documents).where(Documents.id == doc_id)).one_or_none()
            if document:
                all_documents[str(doc_id)] = document
        
        # Fetch all personas individually with fresh session
        from app.models import Personas
        all_personas = {}
        for persona_id in persona_ids:
            persona = fresh_session.exec(select(Personas).where(Personas.id == persona_id)).one_or_none()
            if persona:
                all_personas[str(persona_id)] = persona
        
        # Separate parameters by type
        persona_params = []
        document_params = []
        other_params = []
        
        # Track AI trainer information for clear identification
        ai_trainer_info: list[str] = []
        
        for param in all_parameters:
            if not param.field_id or param.field_id not in field_map:
                continue
                
            field = field_map[param.field_id]
            
            # Handle different field types
            if field.field_type == 'persona':
                if param.value and param.value in all_personas:
                    persona = all_personas[param.value]
                    value = persona.description if persona.description else "No description available"
                    # Add AI trainer identification
                    ai_trainer_info.append(f"AI TRAINER: {persona.name} - {value}")
                else:
                    value = "Persona not found"
                field_description = field.description if field.description else ""
                formatted_line = f"The {field.name} ({field_description}) for this chat is {param.name}: {value}"
                persona_params.append(formatted_line)
            elif field.field_type == 'document':
                if param.value and param.value in all_documents:
                    document = all_documents[param.value]
                    value = document.content if document.content else "No content available"
                else:
                    value = "Document not found"
                field_description = field.description if field.description else ""
                formatted_line = f"The {field.name} ({field_description}) for this chat is {param.name}: {value}"
                document_params.append(formatted_line)
            else:
                # For numerical, categorical, or text fields
                value = param.value if param.value else "No value set"
                field_description = field.description if field.description else ""
                formatted_line = f"The {field.name} ({field_description}) for this chat is {param.name}: {value}"
                other_params.append(formatted_line)
        
        # Return messages with AI trainer clearly identified first
        messages = []
        
        # Add AI trainer identification at the beginning for clarity
        if ai_trainer_info:
            content = "IMPORTANT: " + "\n".join(ai_trainer_info) + "\n\nThis AI trainer will be speaking as the 'assistant' in the conversation history below."
            messages.append({
                "role": "user",
                "content": content
            })
        
        if persona_params:
            content = "\n".join(persona_params)
            messages.append({
                "role": "user",
                "content": content
            })
        
        if document_params:
            content = "\n".join(document_params)
            messages.append({
                "role": "user",
                "content": content
            })
        
        if other_params:
            content = "\n".join(other_params)
            messages.append({
                "role": "user",
                "content": content
            })
        
        return messages  # type: ignore
    except Exception as e:
        logger.error(f"Error fetching parameter history for chat {chat.id}: {e}")
        return []

def get_text_formatted_instructions(
    instructions: List[TResponseInputItem],
) -> str:
    """
    Get the conversation history formatted as text with YOU/USER labels.

    Args:
        messages: List of Messages objects from the database

    Returns:
        Text-formatted conversation history with YOU/USER labels
    """
    formatted_lines = []
    
    for message in instructions:
        if message.get("content", None):
            if message.get("role", None) == 'user':
                formatted_lines.append(f"USER: {message.get('content', None)}")
            elif message.get("role", None) == 'assistant':
                formatted_lines.append(f"YOU: {message.get('content', None)}")
    
    return "\n\n".join(formatted_lines)



def get_assessment_history(
    assessment: Assessments,
    session: Session,
) -> list[TResponseInputItem]:
    """
    Get the assessment history for a given list of messages.
    """
    # find all the questions for the assessment
    all_questions = session.exec(select(Questions).where(Questions.assessment_id == assessment.id)).all()   

    content = ""
    for question in all_questions:
        content += f"Question: {question.stem}\n"
        if question.question_type == "mcq" and question.options:
            for idx, option in enumerate(question.options, 1):
                content += f"  {idx}. {option}\n"
        content += f"Answer: {question.value}\n"

    # create one user message that shows the question and answer to the user
    questions: TResponseInputItem = {
        "role": "user",
        "content": content,
    }
    return [questions]


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



def get_persona_id_from_chat(db_session, chat_id: str, parameter_ids: list[str]) -> Optional[uuid.UUID]:
    """
    Extract persona_id from chat's parameter_ids by finding the parameter with field_type 'persona'
    For interview training, randomly select between regular and cheating candidate if candidate persona is not set
    Returns (persona_id, feedback_updates) where feedback_updates should be applied to chat later
    """
    if not parameter_ids:
        return None
    
    # Use a fresh session for this operation to avoid prepared statement conflicts
    fresh_session = next(get_session())
    try:
        # Get all parameters for this chat with error handling
        parameters = []
        for param_id in parameter_ids:
            try:
                param = fresh_session.exec(
                    select(Parameters).where(Parameters.id == param_id)
                ).one_or_none()
                if param:
                    parameters.append(param)
            except Exception as e:
                logger.warning(f"Error fetching parameter {param_id}: {e}")
                continue
        
        # Get all field IDs to fetch fields efficiently
        field_ids = [param.field_id for param in parameters if param.field_id]
        
        # Fetch all fields individually with fresh session to avoid prepared statement issues
        field_map = {}
        if field_ids:
            try:
                # Use individual queries to avoid UUID.in_() issues
                for field_id in field_ids:
                    field = fresh_session.exec(select(Fields).where(Fields.id == field_id)).one_or_none()
                    if field:
                        field_map[field.id] = field
            except Exception as e:
                logger.warning(f"Error fetching fields: {e}")
                return None
        
        # Find the parameter that has a field with field_type 'persona'
        for param in parameters:
            if param.field_id and param.field_id in field_map:
                field = field_map[param.field_id]
                
                if field.field_type == 'persona' and param.value:
                    # The value should be the persona UUID
                    try:
                        return uuid.UUID(param.value)
                    except ValueError:
                        logger.warning(f"Invalid persona UUID in parameter {param.id}: {param.value}")
                        continue

        return None
    except Exception as e:
        logger.error(f"Error extracting persona_id from chat {chat_id}: {str(e)}")
        return None
    finally:
        fresh_session.close()
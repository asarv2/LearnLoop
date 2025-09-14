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
        
        
        for param in all_parameters:
            if not param.field_id or param.field_id not in field_map:
                continue
                
            field = field_map[param.field_id]
            
            # Handle different field types
            if field.field_type == 'persona':
                if param.value and param.value in all_personas:
                    persona = all_personas[param.value]
                    value = persona.description if persona.description else "No description available"
                else:
                    value = "Persona not found"
                field_description = field.description if field.description else ""
                formatted_line = f"The {field.name} ({field_description}) for this chat is {param.name}"
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
                formatted_line = f"The {field.name} ({field_description}) for this chat is {param.name}"
                other_params.append(formatted_line)
        
        # Return messages
        messages = []
        
        if persona_params:
            content = "\n".join(persona_params)
            messages.append({
                "role": "user",
                "content": "The following is YOUR persona information: " + content
            })
        
        if document_params:
            content = "\n".join(document_params)
            messages.append({
                "role": "user",
                "content": "The following is YOUR document information: " + content
            })
        
        if other_params:
            content = "\n".join(other_params)
            messages.append({
                "role": "user",
                "content": "The following is YOUR other information, also referred to as PARAMETERS: " + content
            })
        
        return messages  # type: ignore
    except Exception as e:
        logger.error(f"Error fetching parameter history for chat {chat.id}: {e}")
        return []

def get_text_formatted_instructions(
    instructions: List[TResponseInputItem],
    history_format: bool = True,
) -> str:
    """
    Get the conversation history formatted as text with YOU/USER labels,
    or just concatenate content if history_format is False.

    Args:
        instructions: List of Messages objects from the database
        history_format: Whether to include role labels

    Returns:
        Text-formatted conversation history
    """
    formatted_lines = []

    for message in instructions:
        content = message.get("content", None)
        if not content:
            continue
        if history_format:
            role = message.get("role", None)
            if role == 'user':
                formatted_lines.append(f"USER: {content}")
            elif role == 'assistant':
                formatted_lines.append(f"YOU: {content}")
        else:
            formatted_lines.append(str(content))

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
                "role": "user",
                "content": f"The following are the parameters for this training session:\n{content}"
            }]
        
        return []
        
    except Exception as e:
        logger.error(f"Error building parameter history from field values: {e}")
        return []
    finally:
        fresh_session.close()


def get_parameter_history_simple(
    chat: Chats,
    session: Session,
) -> list[TResponseInputItem]:
    """
    Get parameter history using a simpler approach similar to generate_scenario.
    This reconstructs the parameter information from the chat's parameter_ids
    but uses the simpler parameter line building logic.
    
    Args:
        chat: Chat object with parameter_ids
        session: Database session for lookups
        
    Returns:
        List of parameter messages formatted for agent consumption
    """
    if not chat.parameter_ids:
        return []
    
    # Use a fresh session for this operation to avoid prepared statement conflicts
    fresh_session = next(get_session())
    try:
        param_lines: list[str] = []
        
        # Fetch all Parameters individually
        for param_id in chat.parameter_ids:
            param = fresh_session.exec(select(Parameters).where(Parameters.id == param_id)).one_or_none()
            if not param or not param.field_id:
                continue
                
            # Get the field to understand its type and name
            field = fresh_session.exec(select(Fields).where(Fields.id == param.field_id)).one_or_none()
            if not field:
                continue
                
            field_name = field.name or "parameter"
            field_description = field.description or ""
            
            # Handle different field types using simpler logic
            if field.field_type == 'persona' and param.value:
                # For persona fields, get the persona description
                from app.models import Personas
                persona = fresh_session.exec(select(Personas).where(Personas.id == param.value)).one_or_none()
                if persona:
                    persona_desc = persona.description if persona.description else "No description available"
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {persona.name}: {persona_desc}")
                else:
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                    
            elif field.field_type == 'document' and param.value:
                # For document fields, get the document content
                document = fresh_session.exec(select(Documents).where(Documents.id == param.value)).one_or_none()
                if document:
                    doc_content = document.content if document.content else "No content available"
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is document {str(param.value)[:8]}: {doc_content}")
                else:
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                    
            elif field.field_type == 'categorical':
                # For categorical fields, use the parameter name
                param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                    
            else:
                # For text, numerical, or other fields, use the parameter value
                value = param.value if param.value else param.name
                if value:
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {value}")
        
        # Return as a single user message with all parameters
        if param_lines:
            content = "\n".join(param_lines)
            return [{
                "role": "user",
                "content": f"The following are the parameters for this training session:\n{content}"
            }]
        
        return []
        
    except Exception as e:
        logger.error(f"Error building simple parameter history for chat {chat.id}: {e}")
        return []
    finally:
        fresh_session.close()


def get_parameter_history_from_scenario(
    scenario: Scenarios,
    session: Session,
) -> list[TResponseInputItem]:
    """
    Build parameter history lines from scenario.parameter_ids instead of chat.
    Returns a single user message with concatenated parameter lines, or empty list.
    """
    try:
        parameter_ids = getattr(scenario, "parameter_ids", None) or []
        if not parameter_ids:
            return []

        # Use fresh session to avoid prepared statement issues in long-lived sessions
        fresh_session = next(get_session())
        try:
            param_lines: list[str] = []
            for pid in parameter_ids:
                param = fresh_session.exec(select(Parameters).where(Parameters.id == pid)).one_or_none()
                if not param or not param.field_id:
                    continue
                field = fresh_session.exec(select(Fields).where(Fields.id == param.field_id)).one_or_none()
                if not field:
                    continue
                field_name = field.name or "parameter"
                field_description = field.description or ""

                if field.field_type == 'persona' and param.value:
                    persona = fresh_session.exec(select(Personas).where(Personas.id == param.value)).one_or_none()
                    if persona:
                        persona_desc = persona.description if persona.description else "No description available"
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {persona.name}: {persona_desc}")
                    else:
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                elif field.field_type == 'document' and param.value:
                    document = fresh_session.exec(select(Documents).where(Documents.id == param.value)).one_or_none()
                    if document:
                        doc_content = document.content if document.content else "No content available"
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is document {str(param.value)[:8]}: {doc_content}")
                    else:
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                elif field.field_type == 'categorical':
                    param_lines.append(f"The {field_name} ({field_description}) for this chat is {param.name}")
                else:
                    value = param.value if param.value else param.name
                    if value:
                        param_lines.append(f"The {field_name} ({field_description}) for this chat is {value}")

            if param_lines:
                return [{
                    "role": "user",
                    "content": "The following are the parameters for this training session:\n" + "\n".join(param_lines)
                }]
            return []
        finally:
            try:
                fresh_session.close()
            except Exception:
                pass
    except Exception as e:
        logger.error(f"Error building parameter history from scenario {scenario.id}: {e}")
        return []


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
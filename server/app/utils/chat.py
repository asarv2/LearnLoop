import logging
import uuid
from typing import List, Sequence

from agents.items import TResponseInputItem
from agents.realtime.items import (AssistantMessageItem, AssistantText,
                                   InputText, UserMessageItem)
from agents.realtime.model_events import RealtimeItem
from app.models import Assessments, Messages, Questions, Rubrics, Standards
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


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


def get_text_formatted_instructions(
    messages: Sequence[Messages],
) -> str:
    """
    Get the conversation history formatted as text with YOU/USER labels.

    Args:
        messages: List of Messages objects from the database

    Returns:
        Text-formatted conversation history with YOU/USER labels
    """
    # Sort messages by created_at
    sorted_messages = sorted(messages, key=lambda x: x.created_at)
    
    formatted_lines = []
    
    for message in sorted_messages:
        if message.content:
            if message.role == "user":
                formatted_lines.append(f"USER: {message.content}")
            elif message.role == "assistant":
                formatted_lines.append(f"YOU: {message.content}")
    
    return "\n\n".join(formatted_lines)


def get_realtime_instructions(
    system_prompt: str,
    messages: Sequence[Messages],
) -> str:
    """
    Get the system prompt for a given agent.

    Args:
        messages: List of Messages objects from the database
        system_prompt: The system prompt for the agent
    Returns:
        The system prompt for the agent
    """

    # Only append conversation history if there are messages
    if len(messages) > 0:
        conversation_text = get_text_formatted_instructions(messages)
        return f"{system_prompt}\n\nThe following is the current history of the conversation. Continue the conversation from this point on:\n\n{conversation_text}"
    
    return system_prompt



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
import logging
from typing import Sequence

from agents.items import TResponseInputItem
from app.models import Assessments, Messages, Questions
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
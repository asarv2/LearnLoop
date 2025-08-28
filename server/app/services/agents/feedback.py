import logging
import uuid
from pathlib import Path
from typing import Any, List, Literal, Optional

from agents import Runner, trace
from app.db import get_session
from app.models import Assessments, Chats, Feedback, Messages, Questions
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_assessment_history, get_conversation_history
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class FeedbackResponse(BaseModel):
    strengths: List[str]
    errors: List[str]


async def get_feedback_prompt() -> str:
    """Read the feedback prompt from the markdown file."""
    # Try multiple possible paths for different environments
    possible_paths = [
        Path(__file__).parent.parent.parent / "lib" / "prompts" / "feedback.md",  # Local development
        Path("/app/app/lib/prompts/feedback.md"),  # Docker container
        Path("/app/lib/prompts/feedback.md"),  # Alternative Docker path
    ]
    
    for prompt_path in possible_paths:
        if prompt_path.exists():
            try:
                with open(prompt_path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception as e:
                logger.error(f"Error reading feedback prompt from {prompt_path}: {str(e)}")
                continue
    
    # If none of the paths work, log all attempted paths and raise error
    logger.error(f"Feedback prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")
    raise FileNotFoundError(f"Feedback prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")


async def run_feedback_agent(
    chat_id: uuid.UUID,
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    This function is used to run the feedback agent.
    Returns a dictionary with feedback analysis.

    Args:
        chat_id: The ID of the chat
        session: Database session

    Returns:
        A dictionary containing feedback analysis and metadata.
    """

    # Get a session if none is provided
    if session is None:
        session = next(get_session())
    
    # Type assertion to help linter understand session is not None
    assert session is not None

    # Get the chat object
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).first()
    if not chat:
        return {
            "success": False,
            "message": f"Chat not found with ID {chat_id}",
            "feedback_id": None,
        }
    
    # Get messages from the chat
    messages = session.exec(select(Messages).where(Messages.chat_id == chat_id)).all()
    conversation_history = get_conversation_history(messages)

    # Get assessment and responses if available
    assessment = session.exec(
        select(Assessments).where(Assessments.chat_id == chat_id)
    ).first()

    if not assessment:
        return {
            "success": False,
            "message": f"No assessment found for chat {chat_id}",
            "feedback_id": None,
        }

    assessment_context = get_assessment_history(assessment, session)

    history = conversation_history + assessment_context

    # Get the feedback prompt from the markdown file
    system_prompt = await get_feedback_prompt()
    
    feedback_agent = GenericAgent(
        agent_name="Feedback Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        output_type=FeedbackResponse,
    )

    try:
        with trace("Feedback"):
            result = await Runner.run(
                feedback_agent.agent(), 
                input=history
            )
            feedback_result = result.final_output_as(FeedbackResponse)

        logger.info(
            f"Successfully generated feedback for chat {chat_id}"
        )

        # Consolidate feedback into strengths and weaknesses
        # Create the Feedback record
        feedback = Feedback(
            chat_id=chat_id,
            training_id=chat.training_id,
            strengths=feedback_result.strengths,
            errors=feedback_result.errors,
            green_flags=[],  # Empty array since we're not using flags anymore
            red_flags=[],   # Empty array since we're not using flags anymore
        )
        session.add(feedback)
        session.commit()

        logger.info(
            f"Successfully saved feedback {feedback.id} to database"
        )

        return {
            "success": True,
            "message": f"Successfully generated and saved feedback",
            "feedback_id": str(feedback.id),
            "chat_id": str(chat_id),
            "chat_title": chat.title,
            "feedback": {
                "strengths": feedback_result.strengths,
                "errors": feedback_result.errors,
                "green_flags": [],
                "red_flags": [],
            }
        }

    except Exception as e:
        logger.error(f"Error during feedback generation: {str(e)}")
        session.rollback()
        return {
            "success": False,
            "message": f"Feedback generation failed: {str(e)}",
            "feedback_id": None,
            "chat_id": str(chat_id),
        }

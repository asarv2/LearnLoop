import logging
import uuid
from pathlib import Path
from typing import Any, List, Optional

from agents import Runner, TResponseInputItem, trace
from app.db import get_session
from app.models import Chats, Hints, Messages
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_conversation_history
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class HintResponse(BaseModel):
    hints: List[str]


async def get_hint_prompt() -> str:
    """Read the hint prompt from the markdown file."""
    # Try multiple possible paths for different environments
    possible_paths = [
        Path(__file__).parent.parent.parent / "lib" / "prompts" / "hint.md",  # Local development
        Path("/app/app/lib/prompts/hint.md"),  # Docker container
        Path("/app/lib/prompts/hint.md"),  # Alternative Docker path
    ]
    
    for prompt_path in possible_paths:
        if prompt_path.exists():
            try:
                with open(prompt_path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception as e:
                logger.error(f"Error reading hint prompt from {prompt_path}: {str(e)}")
                continue
    
    # If none of the paths work, log all attempted paths and raise error
    logger.error(f"Hint prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")
    raise FileNotFoundError(f"Hint prompt file not found. Tried paths: {[str(p) for p in possible_paths]}")


async def run_hint_agent(
    message_id: uuid.UUID,
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    This function is used to run the hint agent.
    Returns a dictionary with hint analysis.

    Args:
        message_id: The ID of the message
        session: Database session

    Returns:
        A dictionary containing hint analysis and metadata.
    """

    # Get a session if none is provided
    created = False
    if session is None:
        session = next(get_session())
        created = True
    
    # Type assertion to help linter understand session is not None
    assert session is not None

    # Get the message object
    message = session.exec(select(Messages).where(Messages.id == message_id)).first()
    if not message:
        return {
            "success": False,
            "message": f"Message not found with ID {message_id}",
            "hint_id": None,
        }
    
    # Get the chat object to access training information
    chat = session.exec(select(Chats).where(Chats.id == message.chat_id)).first()
    if not chat:
        return {
            "success": False,
            "message": f"Chat not found for message {message_id}",
            "hint_id": None,
        }

    # Get all messages from the chat
    all_messages = session.exec(
        select(Messages).where(Messages.chat_id == message.chat_id)
    ).all()
    
    conversation_history = get_conversation_history(all_messages)

    hint_extra: TResponseInputItem = {
        "role": "user",
        "content": "Look back at the previous conversation and provide a hint for the next message."
    }

    full_conversation_history = [*conversation_history, hint_extra]

    # Get the hint prompt from the markdown file
    system_prompt = await get_hint_prompt()
    
    hint_agent = GenericAgent(
        agent_name="Hint Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        output_type=HintResponse,
    )

    try:
        with trace("Hint"):
            result = await Runner.run(
                hint_agent.agent(), 
                input=full_conversation_history
            )
            hint_result = result.final_output_as(HintResponse)

        logger.info(
            f"Successfully generated hints for message {message_id}"
        )

        # Create the Hint record
        hint = Hints(
            message_id=message_id,
            contents=hint_result.hints
        )
        session.add(hint)
        session.commit()

        logger.info(
            f"Successfully saved hint {hint.id} to database"
        )

        return {
            "success": True,
            "message": f"Successfully generated and saved hints",
            "hint_id": str(hint.id),
            "message_id": str(message_id),
            "chat_id": str(message.chat_id),
            "hints": hint_result.hints
        }

    except Exception as e:
        logger.error(f"Error during hint generation: {str(e)}")
        try: session.rollback()
        except Exception: pass
        return {
            "success": False,
            "message": f"Hint generation failed: {str(e)}",
            "hint_id": None,
            "message_id": str(message_id),
        }
    finally:
        if created:
            try: session.close()
            except Exception: pass

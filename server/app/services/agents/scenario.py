import logging
import uuid
from pathlib import Path
from typing import Any

from agents import Runner, trace
from app.db import get_session
from app.models import Chats, Messages
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_parameter_history
from fastapi import Depends
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class ScenarioResponse(BaseModel):
    title: str
    scenario: str
    message: str


async def get_scenario_prompt() -> str:
    """Read the scenario prompt from the markdown file."""
    prompt_path = Path(__file__).parent.parent.parent.parent / "app" / "lib" / "prompts" / "scenario.md"
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        logger.error(f"Scenario prompt file not found at {prompt_path}")
        raise
    except Exception as e:
        logger.error(f"Error reading scenario prompt: {str(e)}")
        raise


async def run_scenario_agent(
    chat_id: uuid.UUID,
    persona_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """
    This function is used to run the scenario agent.
    Returns a dictionary with scenario analysis.

    Args:
        chat_id: The ID of the chat
        persona_id: The ID of the persona
        session: Database session

    Returns:
        A dictionary containing scenario analysis and metadata.
    """

    # Get the chat object
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).first()
    if not chat:
        return {
            "success": False,
            "message": f"Chat not found with ID {chat_id}",
        }
    
    parameter_history = get_parameter_history(chat, session)

    history = parameter_history

    # Get the scenario prompt from the markdown file
    system_prompt = await get_scenario_prompt()
    
    scenario_agent = GenericAgent(
        agent_name="Scenario Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        output_type=ScenarioResponse,
    )

    try:
        with trace("Scenario"):
            result = await Runner.run(
                scenario_agent.agent(), 
                input=history
            )
            scenario_result = result.final_output_as(ScenarioResponse)

        logger.info(
            f"Successfully generated title for chat {chat_id}"
        )

        # Consolidate feedback into strengths and weaknesses
        title = scenario_result.title
        scenario = scenario_result.scenario
        message = scenario_result.message
        # update scenario for chat
        chat.title = title
        chat.description = scenario

        # create a new chat message
        message_object = Messages(
            chat_id=chat.id,
            content=message,
            role="assistant",
            persona_id=persona_id,
        )
        session.add(message_object)
        session.add(chat)
        session.commit()

        logger.info(
            f"Successfully saved scenario {chat.id} to database"
        )

        return {
            "success": True,
            "message": f"Successfully generated and saved scenario",
            "scenario_id": str(chat.id),
            "chat_id": str(chat_id),
            "chat_title": chat.title,
            "scenario": scenario,
        }

    except Exception as e:
        logger.error(f"Error during scenario generation: {str(e)}")
        session.rollback()
        return {
            "success": False,
            "message": f"Scenario generation failed: {str(e)}",
            "scenario_id": None,
            "chat_id": str(chat_id),
        }

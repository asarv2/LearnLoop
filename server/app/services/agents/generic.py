import os
import uuid
from typing import AsyncGenerator

from agents import Agent, ModelSettings, Runner, trace
from agents.items import TResponseInputItem
from agents.models.openai_responses import OpenAIResponsesModel
from app.db import get_session
from app.models import Personas
from dotenv import load_dotenv
from fastapi import Depends
from openai import AsyncOpenAI
from openai.types.responses import ResponseTextDeltaEvent
from pydantic import BaseModel
from sqlmodel import Session, select

load_dotenv()


# this becomes main. Put those other in the files
async def run_generic_agent(
    persona_id: uuid.UUID,
    input_items: list[TResponseInputItem],
    session: Session = Depends(get_session),
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.

    Args:
        persona_id: The ID of the persona
        input_text: Optional input text to send to the agent
    Yields:
        Text chunks from the agent's response
    """
    persona = session.exec(select(Personas).where(Personas.id == persona_id)).one()
    if not persona:
        raise ValueError(f"Persona with ID {persona_id} not found")

    agent_instance = GenericAgent(
        agent_name=persona.name,
        system_prompt=persona.system_prompt or "",
        temperature=persona.temperature or 0.0,
    )

    with trace(f"Testing {persona.name} Agent"):
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
        )

    async for event in result.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                yield chunk


class GenericAgent:
    def __init__(
        self,
        agent_name: str,
        system_prompt: str,
        temperature: float,
        model: str = "gpt-4.1",
        output_type: type[BaseModel] | None = None
    ):
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.output_type = output_type
        self.model = model

    def agent(self) -> Agent:
        return Agent(
            name=f"{self.agent_name}",
            instructions=self.system_prompt,
            model=OpenAIResponsesModel(
                model=self.model,
                openai_client=AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY")),
            ),
            model_settings=ModelSettings(
                temperature=self.temperature,
                include_usage=True,
            ),
            output_type=self.output_type,
        )

import os
import uuid
from typing import Any, AsyncGenerator, Callable, Dict, Optional, Union

from agents import (Agent, ModelSettings, Runner, Tool,
                    ToolsToFinalOutputResult, trace)
from agents.extensions.models.litellm_model import LitellmModel
from agents.items import TResponseInputItem
from agents.models.openai_responses import OpenAIResponsesModel
from app.db import get_session
from app.models import Personas
from dotenv import load_dotenv
from fastapi import Depends
from openai import AsyncOpenAI
from openai.types import Reasoning
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session, select

load_dotenv()


def get_api_key_for_model(model: str) -> str:
    """
    Get the appropriate API key based on the model provider.
    
    Args:
        model: The model string (e.g., "openai/gpt-4", "gemini/gemini-pro", "anthropic/claude-3")
    
    Returns:
        The API key for the model provider
    """
    if model.startswith("openai/"):
        return os.getenv("OPENAI_API_KEY", "")
    elif model.startswith("gemini/"):
        return os.getenv("GEMINI_API_KEY", "")
    elif model.startswith("anthropic/"):
        return os.getenv("ANTHROPIC_API_KEY", "")
    elif model.startswith("xai/"):
        return os.getenv("XAI_API_KEY", "")
    else:
        # Default to OpenAI if no prefix matches
        return os.getenv("OPENAI_API_KEY", "")


def create_model_instance(model: str, api_key: str) -> Union[OpenAIResponsesModel, LitellmModel]:
    """
    Create the appropriate model instance based on the model string.
    
    Args:
        model: The model string
        api_key: The API key for the model
    
    Returns:
        The appropriate model instance
    """
    if model.startswith("openai/"):
        # Use OpenAIResponsesModel for OpenAI models
        openai_model = model.replace("openai/", "")
        return OpenAIResponsesModel(
            model=openai_model,
            openai_client=AsyncOpenAI(api_key=api_key)
        )
    else:
        # Use LiteLLM for all other providers (Gemini, Anthropic, XAI)
        return LitellmModel(
            model=model,
            api_key=api_key
        )


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
        system_prompt=persona.description or "",
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
        temperature: float | None = 0.0,
        model: str = "openai/gpt-4.1",
        tools: list[Tool] = [],
        parallel_tool_calls: bool = False,
        reasoning_effort: str | None = None,
        tool_use_behavior: Optional[Callable] = None,
        include_usage: bool = True
    ):
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model = model
        self.tools = tools
        self.parallel_tool_calls = parallel_tool_calls
        self.reasoning_effort = reasoning_effort
        self.tool_use_behavior = tool_use_behavior
        self.include_usage = include_usage

    def agent(self) -> Agent:
        # Create model settings with proper typing
        model_settings = ModelSettings(
            temperature=self.temperature,
            include_usage=self.include_usage,
        )
        
        # Add parallel tool calls and reasoning if enabled
        if self.parallel_tool_calls:
            model_settings.parallel_tool_calls = True
            model_settings.reasoning = Reasoning(effort=self.reasoning_effort)  # type: ignore
        
        # Get the appropriate API key and create model instance
        api_key = get_api_key_for_model(self.model)
        model_instance = create_model_instance(self.model, api_key)
        
        # Create agent with proper typing
        agent = Agent(
            name=f"{self.agent_name}",
            instructions=self.system_prompt,
            model=model_instance,
            model_settings=model_settings,
            tools=self.tools,
        )
        
        # Add optional parameters
        if self.tool_use_behavior:
            agent.tool_use_behavior = self.tool_use_behavior
        
        return agent

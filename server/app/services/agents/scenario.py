import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional, cast

import httpx
from agents import Runner, function_tool, trace
from app.db import get_session
from app.extensions import load_prompt
from app.models import Chats, Documents, Messages, Parameters
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_parameter_history_from_scenario
from fastapi import Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class ScenarioResponse(BaseModel):
    title: str
    problem_statement: str
    objectives: Optional[List[str]] = None


def create_document_generation_tool(parameter_id: uuid.UUID, template_id: uuid.UUID, parameter_name: str) -> Any:
    """Create a document generation tool for a specific parameter/template combination."""
    
    async def generate_document(
        **kwargs: Any
    ) -> str:
        f"""Generate a document using template {template_id} for parameter {parameter_name}.
        
        This function creates a document using the specified template and uploads it to storage.
        
        Args:
            **kwargs: Arguments for the document template (varies by template)
            
        Returns:
            Document ID of the created document
        """
        try:
            # Get documents service URL from environment
            documents_service_url = os.getenv("DOCUMENTS_SERVICE_URL", "http://localhost:8000")
            
            # Call documents service to create the document
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{documents_service_url}/create",
                    json={
                        "template_id": str(template_id),
                        "kwargs": kwargs
                    },
                    timeout=30.0
                )
                response.raise_for_status()
                
                # Get PDF bytes from response
                pdf_bytes = response.content
            
            # Create document entry in database
            # For now, we'll store a placeholder content since the actual PDF upload
            # will be handled by the client via the existing upload endpoint
            document = Documents(
                content=f"Generated document from template {template_id} for parameter {parameter_name}. PDF ready for upload.",
                profile_id=None  # Will be set by the calling context if needed
            )
            
            # Get database session
            session = next(get_session())
            try:
                session.add(document)
                session.commit()
                session.refresh(document)
                
                # Note: The actual PDF upload to S3/R2 will be handled by the client
                # using the existing /api/v1/documents/{id}/upload endpoint
                # The PDF bytes are available in the response from the documents service
                
                logger.info(f"Successfully created document {document.id} for parameter {parameter_name}")
                return str(document.id)
                
            finally:
                session.close()
                
        except httpx.HTTPStatusError as e:
            error_msg = f"Documents service error: {e.response.status_code} - {e.response.text}"
            logger.error(error_msg)
            return f"Error: {error_msg}"
        except Exception as e:
            error_msg = f"Failed to generate document: {str(e)}"
            logger.error(error_msg)
            return f"Error: {error_msg}"
    
    # Set the function name dynamically
    safe_name = parameter_name.lower().replace(" ", "_").replace("-", "_")
    generate_document.__name__ = f"generate_document_{safe_name}"
    
    # Apply the function_tool decorator
    return function_tool(generate_document)


def create_document_tools_for_parameters(parameter_ids: List[uuid.UUID], session: Session) -> List[Any]:
    """Create document generation tools for each parameter that has a corresponding template."""
    tools = []
    
    # Get documents service URL
    documents_service_url = os.getenv("DOCUMENTS_SERVICE_URL", "http://localhost:8000")
    
    try:
        # Get available template IDs from documents service
        import asyncio
        async def get_available_templates() -> List[str]:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{documents_service_url}/templates", timeout=10.0)
                response.raise_for_status()
                data = response.json()
                template_ids = cast(List[str], data.get("template_ids", []))
                return template_ids
        
        # Run the async function
        available_templates = asyncio.run(get_available_templates())
        available_template_ids = {uuid.UUID(tid) for tid in available_templates}
        
        logger.info(f"Available template IDs: {available_template_ids}")
        
        # Create tools for each parameter that has a corresponding template
        for parameter_id in parameter_ids:
            if parameter_id in available_template_ids:
                # Get parameter details
                parameter = session.exec(select(Parameters).where(Parameters.id == parameter_id)).one_or_none()
                if parameter:
                    parameter_name = parameter.name or f"parameter_{str(parameter_id)[:8]}"
                    tool = create_document_generation_tool(parameter_id, parameter_id, parameter_name)
                    tools.append(tool)
                    logger.info(f"Created document tool for parameter {parameter_name} ({parameter_id})")
                else:
                    logger.warning(f"Parameter {parameter_id} not found in database")
            else:
                logger.info(f"No template found for parameter {parameter_id}")
                
    except Exception as e:
        logger.error(f"Failed to get available templates: {str(e)}")
        # Continue without tools rather than failing completely
    
    return tools


async def get_scenario_prompt() -> str:
    """Read the scenario prompt from the markdown file."""
    return await load_prompt("scenario")


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
    
    # Use scenario parameters for history when generating scenario content
    if not chat.scenario_id:
        return {
            "success": False,
            "message": f"Chat {chat_id} has no scenario_id",
        }
    from app.models import Scenarios
    scenario = session.exec(select(Scenarios).where(Scenarios.id == chat.scenario_id)).one_or_none()
    if not scenario:
        return {
            "success": False,
            "message": f"Scenario {chat.scenario_id} not found for chat {chat_id}",
        }
    parameter_history = get_parameter_history_from_scenario(scenario, session)

    history = parameter_history

    # Get the scenario prompt from the markdown file
    system_prompt = await get_scenario_prompt()
    
    # Create document generation tools for parameters that have corresponding templates
    document_tools = create_document_tools_for_parameters(scenario.parameter_ids, session)
    logger.info(f"Created {len(document_tools)} document generation tools")
    
    scenario_agent = GenericAgent(
        agent_name="Scenario Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        output_type=ScenarioResponse,
        tools=document_tools,
    )

    try:
        with trace("Scenario"):
            result = await Runner.run(
                scenario_agent.agent(), 
                input=history
            )
            scenario_result = result.final_output_as(ScenarioResponse)

        logger.info(f"Successfully generated scenario for chat {chat_id}")

        # Map new fields to chat
        title = scenario_result.title
        problem_statement = scenario_result.problem_statement
        chat.title = title
        chat.description = problem_statement

        # No longer automatically creating intro message - user will select one via modal
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
            "problem_statement": problem_statement,
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

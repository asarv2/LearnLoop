import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, cast

import httpx
from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from app.db import get_session
from app.extensions import load_prompt
from app.models import Chats, Documents, Messages, Parameters
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_parameter_history_from_scenario
from fastapi import Depends
from pydantic import Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global storage for scenario results
scenario_results: Dict[str, Any] = {}
scenario_progress: Dict[str, bool] = {}


def create_scenario_tool() -> Any:
    """Create a function tool for generating scenario title and problem statement."""
    
    async def generate_scenario(
        title: str = Field(description="The title of the scenario"),
        problem_statement: str = Field(description="The detailed problem statement for the scenario")
    ) -> str:
        """Generate the scenario title and problem statement.
        
        Args:
            title: A clear, descriptive title for the scenario
            problem_statement: A detailed description of the problem/situation
            
        Returns:
            Confirmation message of the scenario generation
        """
        scenario_results['scenario'] = {
            'title': title,
            'problem_statement': problem_statement
        }
        scenario_progress['scenario'] = True
        logger.info(f"✓ Generated scenario: {title} - {problem_statement[:50]}...")
        return f"Generated scenario: {title}"
    
    return function_tool(generate_scenario)


def create_objectives_tool() -> Any:
    """Create a function tool for generating scenario objectives."""
    
    async def generate_objectives(
        objectives: List[str] = Field(description="List of learning objectives for the scenario")
    ) -> str:
        """Generate the learning objectives for the scenario.
        
        Args:
            objectives: List of specific, measurable learning objectives
            
        Returns:
            Confirmation message of the objectives generation
        """
        scenario_results['objectives'] = objectives
        scenario_progress['objectives'] = True
        logger.info(f"✓ Generated {len(objectives)} objectives: {objectives[:2] if objectives else 'None'}...")
        return f"Generated {len(objectives)} objectives"
    
    return function_tool(generate_objectives)


def create_persona_prompt_tool(persona_id: uuid.UUID, persona_alias: str, persona_name: str) -> Any:
    """Create a function tool for generating a prompt for a specific persona using an alias."""
    
    async def generate_persona_prompt(
        prompt: str = Field(description=f"Custom prompt for the {persona_alias} persona")
    ) -> str:
        f"""Generate a custom prompt for the {persona_alias} persona.
        
        This function creates a tailored prompt that will be used when this persona
        interacts in the scenario. The prompt should be specific to the persona's
        role and characteristics.
        
        Args:
            prompt: A detailed prompt that defines how {persona_alias} should behave
            
        Returns:
            Confirmation message of the prompt generation
        """
        # Initialize prompts and prompt_mapping dicts if they don't exist
        if 'prompts' not in scenario_results:
            scenario_results['prompts'] = {}
        if 'prompt_mapping' not in scenario_results:
            scenario_results['prompt_mapping'] = {}
        
        # Store prompt using alias as key
        scenario_results['prompts'][persona_alias] = prompt
        # Store mapping from alias to persona_id
        scenario_results['prompt_mapping'][persona_alias] = str(persona_id)
        scenario_progress[f'persona_prompt_{persona_id}'] = True
        logger.info(f"✓ Generated prompt for {persona_alias} ({persona_name}): {prompt[:50]}...")
        return f"Generated prompt for {persona_alias}"
    
    # Set the function name dynamically using alias
    generate_persona_prompt.__name__ = f"create_{persona_alias}_prompt"
    
    return function_tool(generate_persona_prompt)


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
                
                # Collect document ID in global results
                if 'document_ids' not in scenario_results:
                    scenario_results['document_ids'] = []
                scenario_results['document_ids'].append(str(document.id))
                
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


def create_scenario_tools(parameter_ids: List[uuid.UUID], persona_ids: List[uuid.UUID], session: Session) -> List[Any]:
    """Create all scenario function tools including scenario, objectives, persona prompts, and document generation."""
    tools = []
    
    # Add core scenario tools
    tools.append(create_scenario_tool())
    tools.append(create_objectives_tool())
    
    # Add persona prompt tools for each persona with aliases
    from app.models import Personas
    user_count = 1
    agent_count = 1
    
    for persona_id in persona_ids:
        persona = session.exec(select(Personas).where(Personas.id == persona_id)).one_or_none()
        if persona:
            # Determine if this is a user persona (has profile_id) or agent persona
            if persona.profile_id:
                # User persona
                persona_alias = f"user{user_count}"
                user_count += 1
            else:
                # Agent persona
                persona_alias = f"agent{agent_count}"
                agent_count += 1
            
            persona_tool = create_persona_prompt_tool(persona_id, persona_alias, persona.name)
            tools.append(persona_tool)
            logger.info(f"Created persona prompt tool for {persona_alias} ({persona.name})")
        else:
            logger.warning(f"Persona {persona_id} not found in database")
    
    # Add document generation tools for parameters
    document_tools = create_document_tools_for_parameters(parameter_ids, session)
    tools.extend(document_tools)
    
    return tools


async def get_scenario_prompt() -> str:
    """Read the scenario prompt from the markdown file."""
    return await load_prompt("scenario")


async def create_child_scenario(
    parent_scenario: Any,
    title: str,
    problem_statement: str,
    objectives: List[str],
    prompts: Dict[str, str],
    prompt_mapping: Dict[str, str],
    document_ids: List[str],
    parameter_ids: List[str],
    session: Session
) -> Any:
    """Create a child scenario with all the generated data."""
    from app.models import Scenarios

    # Create the child scenario row
    child = Scenarios(
        title=title,
        description=getattr(parent_scenario, "description", None),
        training_id=parent_scenario.training_id,
        rubric_id=parent_scenario.rubric_id,
        field_ids=parent_scenario.field_ids,
        problem_statement=problem_statement,
        objectives=objectives,
        parent_id=parent_scenario.id,
        parameter_ids=parameter_ids,
        prompts=prompts,
        prompt_mapping=prompt_mapping,
        document_ids=document_ids,
    )
    session.add(child)
    session.commit()
    session.refresh(child)
    
    logger.info(f"Created child scenario {child.id} with {len(document_ids)} documents")
    return child


async def run_scenario_agent(
    scenario_id: uuid.UUID,
    field_values: List[dict],
    persona_ids: List[uuid.UUID],
    additional_context: Optional[str] = None,
    create_child: bool = True,
    session: Session = Depends(get_session),
) -> dict[str, Any]:
    """
    This function is used to run the scenario agent.
    Returns a dictionary with scenario analysis and optionally creates a child scenario.

    Args:
        scenario_id: The ID of the scenario to generate from
        field_values: List of field values from the frontend
        persona_ids: List of persona IDs to use for the scenario
        additional_context: Optional additional context to include
        create_child: Whether to create a child scenario (default: True)
        session: Database session

    Returns:
        A dictionary containing scenario analysis and metadata.
    """
    try:
        # Clear previous results
        global scenario_results, scenario_progress
        scenario_results.clear()
        scenario_progress.clear()

        # Get the scenario to use for parameter history
        from app.models import Scenarios
        scenario = session.exec(select(Scenarios).where(Scenarios.id == scenario_id)).one_or_none()
        if not scenario:
            return {
                "success": False,
                "message": f"Scenario {scenario_id} not found",
            }

        # Use field_values to create parameter history
        from app.utils.chat import get_parameter_history_from_field_values
        parameter_history = get_parameter_history_from_field_values(field_values, session)

        # Build context from persona_ids and additional_context
        from agents.items import TResponseInputItem
        context_items: list[TResponseInputItem] = []
        
        # Add additional context if provided
        if additional_context:
            context_items.append({
                "role": "user", 
                "content": f"Additional context: {additional_context}"
            })

        # Combine all context
        history = context_items + parameter_history

        # Get the scenario prompt from the markdown file
        system_prompt = await get_scenario_prompt()
        
        # Create all scenario tools (scenario, objectives, persona prompts, and document generation)
        scenario_tools = create_scenario_tools(scenario.parameter_ids, persona_ids, session)
        logger.info(f"Created {len(scenario_tools)} scenario tools")
        
        # Create tool use behavior to wait for core tools to be called
        def tool_use_behavior(context: Any, tool_results: list[Any]) -> ToolsToFinalOutputResult:
            # We require scenario, objectives, and persona prompt tools to be called
            # Document generation tools are optional
            required_tools = ['scenario', 'objectives']
            # Add persona prompt tools to required tools
            for persona_id in persona_ids:
                required_tools.append(f'persona_prompt_{persona_id}')
            
            completed_required = all(scenario_progress.get(tool, False) for tool in required_tools)
            return ToolsToFinalOutputResult(is_final_output=completed_required)
        
        scenario_agent = GenericAgent(
            agent_name="Scenario Generator",
            system_prompt=system_prompt,
            temperature=0.0,
            tools=scenario_tools,
            parallel_tool_calls=True,
            reasoning_effort="low",
            tool_use_behavior=tool_use_behavior,
        )

        agent_instance = scenario_agent.agent()

        # Run the scenario generation with parallel tool calls
        logger.info("Running scenario generation agent...")
        with trace("Scenario"):
            result = await Runner.run(agent_instance, input=history)

        logger.info("Scenario generation agent completed successfully")
        
        # Check if required tools were called
        required_tools = ['scenario', 'objectives']
        # Add persona prompt tools to required tools
        for persona_id in persona_ids:
            required_tools.append(f'persona_prompt_{persona_id}')
        
        completed_required = [tool for tool in required_tools if scenario_progress.get(tool, False)]
        logger.info(f"Scenario generation completed: {len(completed_required)}/{len(required_tools)} required tools called")
        
        if len(completed_required) < len(required_tools):
            missing_tools = [tool for tool in required_tools if not scenario_progress.get(tool, False)]
            logger.warning(f"Missing tool calls for: {missing_tools}")
            return {
                "success": False,
                "message": f"Scenario generation incomplete - missing: {missing_tools}",
                "scenario_id": None,
            }
        
        # Extract results from the global storage
        scenario_data = scenario_results.get('scenario', {})
        objectives = scenario_results.get('objectives', [])
        prompts = scenario_results.get('prompts', {})
        prompt_mapping = scenario_results.get('prompt_mapping', {})
        document_ids = scenario_results.get('document_ids', [])
        
        title = scenario_data.get('title', '')
        problem_statement = scenario_data.get('problem_statement', '')
        
        if not title or not problem_statement:
            logger.error("Missing required scenario data")
            return {
                "success": False,
                "message": "Scenario generation failed - missing title or problem statement",
                "scenario_id": None,
            }

        logger.info(f"Successfully generated scenario for scenario {scenario_id}")

        # Create child scenario if requested
        child_scenario = None
        if create_child:
            # Build parameter_ids from field_values
            parameter_ids = []
            for fv in field_values:
                field_id = fv.get("fieldId")
                value = (fv.get("value") or "").strip()
                pid = fv.get("parameterId")
                if pid:
                    parameter_ids.append(str(pid))
                elif field_id:
                    # Create new parameter if needed
                    from app.models import Parameters
                    try:
                        new_param = Parameters(
                            field_id=field_id,
                            name=value,
                            value=value,
                        )
                        session.add(new_param)
                        session.commit()
                        session.refresh(new_param)
                        parameter_ids.append(str(new_param.id))
                    except Exception:
                        logger.exception("Failed to create parameter from field value")

            child_scenario = await create_child_scenario(
                parent_scenario=scenario,
                title=title,
                problem_statement=problem_statement,
                objectives=objectives,
                prompts=prompts,
                prompt_mapping=prompt_mapping,
                document_ids=document_ids,
                parameter_ids=parameter_ids,
                session=session
            )

        return {
            "success": True,
            "message": f"Successfully generated scenario",
            "scenario_id": str(scenario_id),
            "title": title,
            "problem_statement": problem_statement,
            "objectives": objectives,
            "prompts": prompts,
            "prompt_mapping": prompt_mapping,
            "document_ids": document_ids,
            "child_scenario_id": str(child_scenario.id) if child_scenario else None,
        }

    except Exception as e:
        logger.error(f"Error during scenario generation: {str(e)}", exc_info=True)
        session.rollback()
        return {
            "success": False,
            "message": f"Scenario generation failed: {str(e)}",
            "scenario_id": None,
        }

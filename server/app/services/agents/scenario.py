import asyncio
import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type, cast

import aioboto3
import httpx
from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from app.db import get_session
from app.extensions import load_prompt
from app.models import Chats, Documents, Messages, Parameters
from app.services.agents.generic import GenericAgent
from app.utils.tools_args_model import (build_args_model_from_spec,
                                        make_flat_tool_from_args_model)
from botocore.config import Config
from dotenv import load_dotenv
from fastapi import Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

load_dotenv()

logger = logging.getLogger(__name__)

# Global storage for scenario results
scenario_results: Dict[str, Any] = {}
scenario_progress: Dict[str, bool] = {}

# Global HTTP client for reuse across tools
HTTPX_CLIENT = httpx.AsyncClient(
    timeout=30.0,
    http2=True,  # Enable HTTP/2 for better performance
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
)

# Context for socket routing
_scenario_socket_context: Dict[str, str] = {}  # scenario_id -> socket_id


def _emit_progress_fire_and_forget(event: str, data: Dict[str, Any], to: Optional[str] = None) -> None:
    """Fire-and-forget socketio emit to avoid blocking tool execution."""
    try:
        from app.main import get_socketio_instance
        sio = get_socketio_instance()
        
        # Use provided 'to' or try to find socket context
        target = to
        if not target and _scenario_socket_context:
            # Use the first available socket context (for simplicity)
            # In a more complex setup, you'd pass scenario_id to identify the right socket
            target = next(iter(_scenario_socket_context.values()))
        
        # Create fire-and-forget task
        if target:
            asyncio.create_task(sio.emit(event, data, to=target))
        else:
            asyncio.create_task(sio.emit(event, data))
    except Exception as e:
        logger.warning(f"Failed to emit {event}: {e}")


async def cleanup_http_client() -> None:
    """Clean up the global HTTPX client on shutdown."""
    try:
        await HTTPX_CLIENT.aclose()
        logger.info("HTTPX client closed")
    except Exception as e:
        logger.warning(f"Failed to close HTTPX client: {e}")


async def upload_pdf_to_s3(pdf_bytes: bytes, doc_id: str) -> None:
    """Upload PDF bytes to S3 storage using Supabase S3 configuration."""
    try:
        # Get S3 configuration from environment variables
        project_region = os.getenv("PROJECT_REGION")
        s3_endpoint = os.getenv("S3_ENDPOINT")
        access_key = os.getenv("ACCESS_KEY")
        secret_key = os.getenv("SECRET_KEY")
        bucket_name = "documents"
        
        logger.info(f"S3 config - endpoint: {s3_endpoint}, region: {project_region}, access_key: {'***' if access_key else 'None'}")
        
        if not all([s3_endpoint, access_key, secret_key]):
            logger.error("Missing S3 configuration environment variables")
            logger.error(f"Missing: endpoint={bool(s3_endpoint)}, access_key={bool(access_key)}, secret_key={bool(secret_key)}")
            raise ValueError("S3 configuration incomplete")
        
        # Supabase-specific configuration
        cfg = Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"}  # required for Supabase S3 gateway
        )
        
        # Create async S3 client with Supabase configuration
        session = aioboto3.Session()
        async with session.client(
            "s3",
            region_name=project_region,
            endpoint_url=s3_endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=cfg,
        ) as s3:
            # Upload PDF bytes to S3
            key = f"{doc_id}.pdf"
            
            await s3.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=pdf_bytes,
                ContentType="application/pdf"
            )
            
            logger.info(f"Successfully uploaded PDF {key} to S3 bucket {bucket_name}")
        
    except Exception as e:
        logger.error(f"Failed to upload PDF to S3: {str(e)}")
        raise


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
        
        # Emit progress event (fire-and-forget)
        _emit_progress_fire_and_forget("scenario_progress", {
            "type": "scenario",
            "completed": True,
            "message": f"Generated scenario: {title}"
        })
        
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
        
        # Emit progress event (fire-and-forget)
        _emit_progress_fire_and_forget("scenario_progress", {
            "type": "objectives",
            "completed": True,
            "message": f"Generated {len(objectives)} objectives",
            "count": len(objectives)
        })
        
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
        
        # Emit progress event (fire-and-forget)
        _emit_progress_fire_and_forget("scenario_progress", {
            "type": "persona_prompt",
            "completed": True,
            "message": f"Generated prompt for {persona_alias}",
            "persona_alias": persona_alias,
            "persona_name": persona_name
        })
        
        logger.info(f"✓ Generated prompt for {persona_alias} ({persona_name}): {prompt[:50]}...")
        return f"Generated prompt for {persona_alias}"
    
    # Set the function name dynamically using alias
    generate_persona_prompt.__name__ = f"create_{persona_alias}_prompt"
    
    return function_tool(generate_persona_prompt)


def _humanize(s: str) -> str:
    """Convert template names to human-readable format."""
    # fallbacks: "performance-review" -> "Performance Review"
    return " ".join(w.capitalize() for w in s.replace("_", " ").replace("-", " ").split())

async def create_document_generation_tool(
    *,
    parameter_id: uuid.UUID,
    template_id: uuid.UUID,
    parameter_name: str,
    documents_service_url: str,
) -> Any:
    """Create a document generation tool for a specific parameter/template combination with typed Args parameter."""

    # 1) Pull the template spec and build a strict Args model
    r = await HTTPX_CLIENT.get(f"{documents_service_url}/templates/{template_id}/spec")
    r.raise_for_status()
    spec = r.json()  # has "fields", "json_schema", "default_filename", "template_description"
    
    # 2) Extract template metadata for better tool naming and description
    default_filename = spec.get("default_filename")  # from DEFAULT_FILENAME
    template_desc = spec.get("template_description")  # from TEMPLATE_DESCRIPTION
    tool_title = default_filename or parameter_name or f"Template {str(template_id)[:8]}"
    tool_name = f"{tool_title.lower().replace(' ', '_').replace('-', '_')}_doc"
    
    ArgsModel = build_args_model_from_spec(
        model_name=f"TemplateArgs_{str(template_id)[:8]}",
        spec_fields=spec.get("fields", {}),
    )

    # 3) Use the template description as the tool description
    description = template_desc or f"Generate document using {_humanize(tool_title)} template."

    # 4) Define the implementation function
    async def _impl(validated_args: BaseModel) -> str:
        """Generate a document using the template and upload to S3. Returns the document ID."""
        try:
            ds_url = documents_service_url
            if not ds_url:
                logger.warning("DOCUMENTS_SERVICE_URL not set")
                return "Error: documents service not configured"

            # Handle both Pydantic v1 and v2 model serialization
            try:
                # Pydantic v2
                kwargs_data = validated_args.model_dump(exclude_none=True)  # type: ignore
            except AttributeError:
                # Pydantic v1
                kwargs_data = validated_args.dict(exclude_none=True)  # type: ignore
            
            payload = {
                "template_id": str(template_id),
                "kwargs": kwargs_data,
            }

            resp = await HTTPX_CLIENT.post(f"{ds_url}/create", json=payload)
            resp.raise_for_status()
            response_data = resp.json()
            pdf_bytes_base64 = response_data["pdf_bytes_base64"]
            text_content = response_data["text_content"]
            filename = response_data["filename"]
            
            # Decode base64 PDF bytes
            pdf_bytes = base64.b64decode(pdf_bytes_base64)

            document = Documents(
                content=text_content,
                title=filename,
                profile_id=None
            )

            session = next(get_session())
            try:
                session.add(document)
                session.commit()
                session.refresh(document)
                
                # Try to upload to S3, but don't fail the entire generation if it fails
                try:
                    await upload_pdf_to_s3(pdf_bytes, str(document.id))
                except Exception as s3_error:
                    logger.warning(f"S3 upload failed for document {document.id}: {s3_error}")
                    # Continue with document generation even if S3 upload fails
                
                scenario_results.setdefault("document_ids", []).append(str(document.id))
                
                # Track progress for this document tool
                scenario_progress[tool_name] = True
                
                # Emit progress event (fire-and-forget)
                _emit_progress_fire_and_forget("scenario_progress", {
                    "type": "document",
                    "completed": True,
                    "message": f"Generated document: {filename}",
                    "document_id": str(document.id),
                    "filename": filename,
                    "parameter_name": parameter_name
                })
                
                logger.info(f"Created document {document.id} for parameter {parameter_name}")
                return str(document.id)
            finally:
                session.close()

        except httpx.HTTPStatusError as e:
            msg = f"Documents service error: {e.response.status_code} - {e.response.text}"
            logger.error(msg)
            return f"Error: {msg}"
        except Exception as e:
            msg = f"Failed to generate document: {e}"
            logger.error(msg, exc_info=True)
            return f"Error: {msg}"

    # 5) Create the flat tool with explicit typed parameters
    flat_fn = make_flat_tool_from_args_model(
        tool_name=tool_name,
        description=description,
        ArgsModel=ArgsModel,
        call_impl=_impl,
    )

    # 6) Return the tool with proper metadata
    return function_tool(flat_fn)


async def create_document_tools_for_parameters(parameter_ids: List[uuid.UUID], session: Session) -> tuple[List[Any], List[Dict[str, str]]]:
    """Create document generation tools for each parameter that has a corresponding template.
    
    Returns:
        tuple: (tools_list, tool_metadata_list) where tool_metadata_list contains dicts with 'name' and 'description' keys
    """
    tools: List[Any] = []
    tool_metadata: List[Dict[str, str]] = []
    
    # Get documents service URL
    documents_service_url = os.getenv("DOCUMENTS_SERVICE_URL")
    if not documents_service_url:
        logger.warning("DOCUMENTS_SERVICE_URL not set, skipping document tools creation")
        return tools, tool_metadata
    
    try:
        # Get available template IDs from documents service
        response = await HTTPX_CLIENT.get(f"{documents_service_url}/templates")
        response.raise_for_status()
        data = response.json()
        template_ids = cast(List[str], data.get("template_ids", []))
        available_template_ids = {uuid.UUID(tid) for tid in template_ids}
        
        logger.info(f"Available template IDs: {available_template_ids}")
        
        # Create tools for each parameter that has a corresponding template
        for parameter_id in parameter_ids:
            if parameter_id in available_template_ids:
                # Get parameter details
                parameter = session.exec(select(Parameters).where(Parameters.id == parameter_id)).one_or_none()
                if parameter:
                    parameter_name = parameter.name or f"parameter_{str(parameter_id)[:8]}"
                    
                    # Get template spec for metadata
                    r = await HTTPX_CLIENT.get(f"{documents_service_url}/templates/{parameter_id}/spec")
                    r.raise_for_status()
                    spec = r.json()
                    
                    # Extract metadata
                    default_filename = spec.get("default_filename")
                    template_desc = spec.get("template_description")
                    tool_title = default_filename or parameter_name or f"Template {str(parameter_id)[:8]}"
                    tool_name = f"{tool_title.lower().replace(' ', '_').replace('-', '_')}_doc"
                    description = template_desc or f"Generate document using {_humanize(tool_title)} template."
                    
                    tool = await create_document_generation_tool(
                        parameter_id=parameter_id,
                        template_id=parameter_id,  # one-to-one mapping you're using
                        parameter_name=parameter_name,
                        documents_service_url=documents_service_url,
                    )
                    tools.append(tool)
                    tool_metadata.append({
                        'name': tool_name,
                        'description': description
                    })
                    logger.info(f"Created document tool for parameter {parameter_name} ({parameter_id})")
                else:
                    logger.warning(f"Parameter {parameter_id} not found in database")
            else:
                logger.info(f"No template found for parameter {parameter_id}")
                
    except Exception as e:
        logger.error(f"Failed to get available templates: {str(e)}")
        # Continue without tools rather than failing completely
    
    return tools, tool_metadata


async def create_scenario_tools(parameter_ids: List[uuid.UUID], persona_ids: List[uuid.UUID], session: Session) -> tuple[List[Any], List[Dict[str, str]]]:
    """Create all scenario function tools including scenario, objectives, persona prompts, and document generation.
    
    Returns:
        tuple: (tools_list, document_tool_metadata_list) where document_tool_metadata_list contains dicts with 'name' and 'description' keys for document tools only
    """
    tools: List[Any] = []
    
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
            logger.error(f"Persona {persona_id} not found in database - this will cause scenario generation to fail")
            # Continue without this persona rather than failing completely
    
    # Add document generation tools for parameters
    document_tools, document_tool_metadata = await create_document_tools_for_parameters(parameter_ids, session)
    tools.extend(document_tools)
    
    return tools, document_tool_metadata


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
    socket_id: Optional[str] = None,
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
        
        # Store socket context for routing progress events
        if socket_id:
            _scenario_socket_context[str(scenario_id)] = socket_id

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
        
        # Add persona information for the model to understand who each persona is
        from app.models import Personas
        persona_info_lines = []
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
                
                persona_info_lines.append(f"- {persona_alias}: {persona.name} - {persona.description or 'No description available'}")
        
        if persona_info_lines:
            persona_info_content = "Available personas for this scenario:\n" + "\n".join(persona_info_lines)
            context_items.append({
                "role": "developer",
                "content": persona_info_content
            })
        
        # Add additional context if provided
        if additional_context:
            context_items.append({
                "role": "developer", 
                "content": f"Additional context: {additional_context}"
            })

        # Combine all context
        history = context_items + parameter_history

        # Get the scenario prompt from the markdown file
        system_prompt = await get_scenario_prompt()
        
        # Create all scenario tools (scenario, objectives, persona prompts, and document generation)
        scenario_tools, document_tool_metadata = await create_scenario_tools(scenario.parameter_ids, persona_ids, session)
        logger.info(f"Created {len(scenario_tools)} scenario tools")
        
        # Add tools information for the model to understand what's available
        # Only show document generation tools, not all tools
        if document_tool_metadata:
            tools_info_lines = []
            for metadata in document_tool_metadata:
                tool_name = metadata['name']
                tool_desc = metadata['description']
                # Clean up the description (remove extra whitespace)
                tool_desc = ' '.join(tool_desc.split()) if tool_desc else 'No description available'
                tools_info_lines.append(f"- {tool_name}: {tool_desc}")
            
            tools_info_content = "Available document generation tools:\n" + "\n".join(tools_info_lines)
            context_items.append({
                "role": "developer",
                "content": tools_info_content
            })
        
        # Update history with tools information
        history = context_items + parameter_history
        
        # Build persona existence map from the personas we already fetched for context
        persona_exists_map = {}
        for persona_id in persona_ids:
            # We already verified these personas exist when building context above
            persona_exists_map[persona_id] = True

        # Create tool use behavior to wait for core tools to be called
        def tool_use_behavior(context: Any, tool_results: list[Any]) -> ToolsToFinalOutputResult:
            # We require scenario, objectives, persona prompt tools, AND document generation tools to be called
            required_tools = ['scenario', 'objectives']
            # Add persona prompt tools to required tools (only for personas that exist)
            for persona_id in persona_ids:
                if persona_exists_map.get(persona_id, False):
                    required_tools.append(f'persona_prompt_{persona_id}')
            
            # Add document generation tools to required tools (all document tools should be required)
            for tool_metadata in document_tool_metadata:
                tool_name = tool_metadata['name']
                required_tools.append(tool_name)
            
            completed_required = all(scenario_progress.get(tool, False) for tool in required_tools)
            return ToolsToFinalOutputResult(is_final_output=completed_required)
    
        scenario_agent = GenericAgent(
            agent_name="Scenario Generator",
            system_prompt=system_prompt,
            temperature=0.0,
            tools=scenario_tools,  # scenario_tools is already just the tools list from the tuple
            parallel_tool_calls=True,
            tool_use_behavior=tool_use_behavior,
            model="gpt-4.1-nano"
        )

        agent_instance = scenario_agent.agent()

        # Run the scenario generation with parallel tool calls
        logger.info("Running scenario generation agent...")
        
        # Emit initial progress event
        _emit_progress_fire_and_forget("scenario_progress", {
            "type": "start",
            "message": "Starting scenario generation",
            "total_tools": len(scenario_tools),
            "document_tools_count": len(document_tool_metadata)
        })
        
        with trace("Scenario"):
            # Use streamed runner for better progress visibility
            streamed_result = Runner.run_streamed(agent_instance, input=history)
            
            # Optionally handle streaming events for even more granular progress
            async for event in streamed_result.stream_events():
                # Could emit planning/tool-call started events here if needed
                pass

        logger.info("Scenario generation agent completed successfully")
        
        # Check if required tools were called
        required_tools = ['scenario', 'objectives']
        # Add persona prompt tools to required tools (only for personas that exist)
        for persona_id in persona_ids:
            if persona_exists_map.get(persona_id, False):
                required_tools.append(f'persona_prompt_{persona_id}')
        
        # Add document generation tools to required tools (all document tools should be required)
        for tool_metadata in document_tool_metadata:
            tool_name = tool_metadata['name']
            required_tools.append(tool_name)
        
        completed_required = [tool for tool in required_tools if scenario_progress.get(tool, False)]
        logger.info(f"Scenario generation completed: {len(completed_required)}/{len(required_tools)} required tools called")
        logger.info(f"Required tools: {required_tools}")
        logger.info(f"Completed tools: {completed_required}")
        logger.info(f"Document tools created: {[tool['name'] for tool in document_tool_metadata]}")
        
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

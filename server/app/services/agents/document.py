"""
Document Agent for generating document templates.

This agent generates Python code for document templates, specifically:
1. Args class (pydantic BaseModel) with fields for all document sections
2. render function that compiles PDF using PyLaTeX and returns bytes

The agent uses xAI models and follows the same pattern as other agents in the system.
"""

import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Union

from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from app.extensions import load_prompt
from app.services.agents.generic import GenericAgent
from pydantic import Field

logger = logging.getLogger(__name__)


def create_args_tool() -> Any:
    """Create a function tool for generating the Args class."""
    
    async def generate_args_class(
        args_code: str = Field(description="Complete Python code for the Args class (pydantic BaseModel) with all required fields and descriptions")
    ) -> str:
        """Generate the Args class for the document template.
        
        This function should output complete Python code that defines a pydantic BaseModel
        with all the fields needed for the document template. Each field should have:
        - Appropriate type annotation
        - Default value (usually empty string for text fields)
        - Description for the field
        
        Args:
            args_code: Complete Python class definition for Args
            
        Returns:
            Confirmation message
        """
        # Store the generated code
        document_results['args_code'] = args_code
        document_progress['args_code'] = True
        logger.info(f"✓ Generated Args class with {len(re.findall(r'def __init__|class Args', args_code))} definitions")
        return f"Generated Args class with {len(re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*:', args_code))} fields"
    
    return function_tool(generate_args_class)


def create_render_tool() -> Any:
    """Create a function tool for generating the render function."""
    
    async def generate_render_function(
        render_code: str = Field(description="Complete Python code for the render(args: Args) -> bytes function using PyLaTeX")
    ) -> str:
        """Generate the render function for the document template.
        
        This function should output complete Python code that:
        - Takes an Args instance as parameter
        - Uses PyLaTeX to create a PDF document
        - Handles LaTeX escaping properly
        - Returns PDF bytes
        - Uses TemporaryDirectory for compilation
        - Handles errors gracefully
        
        Args:
            render_code: Complete Python function definition for render
            
        Returns:
            Confirmation message
        """
        # Store the generated code
        document_results['render_code'] = render_code
        document_progress['render_code'] = True
        lines = render_code.split('\n')
        logger.info(f"✓ Generated render function with {len(lines)} lines")
        return f"Generated render function with {len(lines)} lines of code"
    
    return function_tool(generate_render_function)


# Global storage for document generation results
document_results: Dict[str, Any] = {}
document_progress: Dict[str, bool] = {}


async def run_document_agent(
    document_type: str,
    document_structure: str,
    context: Optional[str] = None
) -> Dict[str, str]:
    """
    Run the document agent to generate Args class and render function for a document template.
    
    Args:
        document_type: Type of document (e.g., "pitch deck", "incident report", "resume")
        document_structure: Structure/headings from the reference document
        context: Additional context about the document requirements
        
    Returns:
        Dictionary containing the generated args_code and render_code
    """
    # Load the document prompt
    prompt = await load_prompt("document")
    
    # Replace placeholders in the prompt
    system_prompt = str(prompt).replace(
        "Reference document: \"\"\"<paste trimmed structure/headings from your source doc>\"\"\"",
        f"Reference document: \"\"\"{document_structure}\"\"\""
    ).replace(
        "Context: Pitch deck template",
        f"Context: {document_type} template"
    )
    
    if context:
        system_prompt += f"\n\nAdditional Context: {context}"
    
    # Create tools for the agent
    tools = [
        create_args_tool(),
        create_render_tool()
    ]
    
    # Create tool use behavior to wait for both tools to be called
    def tool_use_behavior(context: Any, tool_results: list[Any]) -> ToolsToFinalOutputResult:
        # We require both args_code and render_code tools to be called
        required_tools = ['args_code', 'render_code']
        completed_required = all(document_progress.get(tool, False) for tool in required_tools)
        return ToolsToFinalOutputResult(is_final_output=completed_required)

    # Create the document agent using GenericAgent directly
    document_agent = GenericAgent(
        agent_name="Document Generator",
        system_prompt=system_prompt,
        temperature=0.0,
        tools=tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
        model="xai/grok-4-fast-non-reasoning"
    )

    agent_instance = document_agent.agent()
    
    # Clear previous results
    document_results.clear()
    document_progress.clear()
    
    # Input for the agent
    input_text = f"""
Generate a complete document template for a {document_type}.

Document Structure:
{document_structure}

Requirements:
1. Create an Args class (pydantic BaseModel) with fields for all sections
2. Create a render function that compiles to PDF using PyLaTeX
3. Use proper LaTeX escaping
4. Return PDF bytes, not file paths
5. Use TemporaryDirectory for compilation
6. Handle errors gracefully

Please generate both the Args class and render function.
"""
    
    with trace("Document Generation Agent"):
        # Use streamed runner for better progress visibility
        streamed_result = Runner.run_streamed(agent_instance, input=[{"role": "user", "content": input_text}])
        
        # Optionally handle streaming events for even more granular progress
        async for event in streamed_result.stream_events():
            # Could emit planning/tool-call started events here if needed
            pass

    logger.info("Document generation agent completed successfully")
    
    # Check if required tools were called
    required_tools = ['args_code', 'render_code']
    completed_required = [tool for tool in required_tools if document_progress.get(tool, False)]
    logger.info(f"Document generation completed: {len(completed_required)}/{len(required_tools)} required tools called")
    logger.info(f"Required tools: {required_tools}")
    logger.info(f"Completed tools: {completed_required}")
    
    if len(completed_required) < len(required_tools):
        missing_tools = [tool for tool in required_tools if not document_progress.get(tool, False)]
        logger.warning(f"Missing tool calls for: {missing_tools}")
        raise RuntimeError(f"Document generation incomplete - missing: {missing_tools}")
    
    return {
        'args_code': document_results.get('args_code', ''),
        'render_code': document_results.get('render_code', ''),
        'document_type': document_type
    }
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
    
    # Create the document agent
    agent_instance = DocumentAgent(
        agent_name="Document Generator",
        system_prompt=system_prompt,
        temperature=0.1,  # Low temperature for consistent code generation
        model="xai/groq-llama-3.1-70b-versatile",  # Using xAI as requested
        tools=tools,
        parallel_tool_calls=True
    )
    
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
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=[{"role": "user", "content": input_text}],
        )
    
    # Wait for the agent to complete
    async for event in result.stream_events():
        # Check if we have both components generated
        if document_progress.get('args_code', False) and document_progress.get('render_code', False):
            break
    
    # Check if both components were generated
    if not document_progress.get('args_code', False):
        raise RuntimeError("Failed to generate Args class")
    if not document_progress.get('render_code', False):
        raise RuntimeError("Failed to generate render function")
    
    return {
        'args_code': document_results.get('args_code', ''),
        'render_code': document_results.get('render_code', ''),
        'document_type': document_type
    }


class DocumentAgent:
    def __init__(
        self,
        agent_name: str,
        system_prompt: str,
        temperature: float = 0.1,
        model: str = "xai/groq-llama-3.1-70b-versatile",
        tools: List[Any] = [],
        parallel_tool_calls: bool = True
    ):
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model = model
        self.tools = tools
        self.parallel_tool_calls = parallel_tool_calls

    def agent(self) -> Any:
        """Create the document generation agent."""
        return GenericAgent(
            agent_name=self.agent_name,
            system_prompt=self.system_prompt,
            temperature=self.temperature,
            model=self.model,
            tools=self.tools,
            parallel_tool_calls=self.parallel_tool_calls
        ).agent()


# Example usage:
# result = await run_document_agent(
#     document_type="resume",
#     document_structure="Personal Information, Professional Summary, Work Experience, Education, Skills",
#     context="Professional resume for software engineering positions"
# )

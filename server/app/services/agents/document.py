"""
Document Agent for generating document templates.

This agent generates Python code for document templates, specifically:
1. Args class (pydantic BaseModel) with fields for all document sections
2. render function that compiles PDF using PyLaTeX and returns bytes

The agent uses xAI models and follows the same pattern as other agents in the system.
"""

import logging
import os
import re
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import aiohttp
from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from agents.items import TResponseInputItem
from app.extensions import load_prompt
from app.services.agents.generic import GenericAgent
from pydantic import Field

logger = logging.getLogger(__name__)


def _enhance_render_function(render_code: str) -> str:
    """
    Enhance the generated render function with proper boilerplate code.
    
    This function:
    1. Adds proper imports
    2. Adds the _escape_latex helper function
    3. Wraps the core logic with proper compilation boilerplate
    """
    # Define the boilerplate imports and helper function
    imports_and_helper = '''
import time
from pathlib import Path
from subprocess import CalledProcessError
from tempfile import TemporaryDirectory
from typing import Optional

from pydantic import BaseModel, Field
# PyLaTeX
from pylatex import Command, Document, NoEscape, Package, Section, Subsection  # type: ignore
from pylatex.utils import bold  # type: ignore


def _escape_latex(text: str) -> str:
    """Escape special LaTeX characters in text."""
    if not text:
        return ""
    
    # Replace special LaTeX characters
    replacements = {
        '\\\\': r'\\textbackslash{}',
        '{': r'\\{',
        '}': r'\\}',
        '$': r'\\$',
        '&': r'\\&',
        '%': r'\\%',
        '#': r'\\#',
        '^': r'\\textasciicircum{}',
        '_': r'\\_',
        '~': r'\\textasciitilde{}',
    }
    
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    
    return text


'''
    
    # Extract the core logic from the generated render function
    # Remove any existing imports and function definition
    lines = render_code.strip().split('\n')
    
    # Find the start of the actual render function logic
    render_start = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('def render('):
            render_start = i
            break
    
    # Extract just the function definition and body
    render_function_lines = lines[render_start:]
    
    # Find where the function body ends (look for the last line that's not just whitespace)
    render_end = len(render_function_lines)
    for i in range(len(render_function_lines) - 1, -1, -1):
        if render_function_lines[i].strip():
            render_end = i + 1
            break
    
    render_function_body = '\n'.join(render_function_lines[:render_end])
    
    # Extract the core document building logic (everything except the compilation part)
    # We'll wrap it with proper compilation boilerplate
    core_logic_lines = render_function_body.split('\n')
    
    # Find where the document building ends (before any compilation attempts)
    doc_building_end = 0
    for i, line in enumerate(core_logic_lines):
        line_lower = line.lower().strip()
        # Look for compilation-related code that we want to replace
        if any(keyword in line_lower for keyword in ['generate_pdf', 'generate_tex', 'temporarydirectory', 'pdf_bytes', 'temp_dir']):
            doc_building_end = i
            break
        doc_building_end = len(core_logic_lines)
    
    # Extract the document building logic
    doc_building_logic = '\n'.join(core_logic_lines[:doc_building_end])
    
    # Create the enhanced render function with proper boilerplate
    compilation_boilerplate = '''
    # Compile to a temp dir; return bytes
    ts = int(time.time())
    stem = f"document_{ts}"  # no .pdf suffix; PyLaTeX adds it
    with TemporaryDirectory() as tmp:
        out = Path(tmp) / stem
        try:
            doc.generate_pdf(
                filepath=str(out),
                clean=True,
                clean_tex=True,
                compiler="xelatex",
                silent=True,
            )
        except CalledProcessError as e:
            pdf_file = out.with_suffix(".pdf")
            if not (pdf_file.exists() and pdf_file.stat().st_size > 0):
                raise RuntimeError(f"XeLaTeX failed and no PDF produced (code {e.returncode}).") from e
        pdf_file = out.with_suffix(".pdf")
        if not pdf_file.exists() or pdf_file.stat().st_size == 0:
            raise RuntimeError("PDF not generated or empty.")
        return pdf_file.read_bytes()
'''
    
    enhanced_function = imports_and_helper + doc_building_logic + compilation_boilerplate
    
    return enhanced_function


def _enhance_args_class(args_code: str, document_type: str) -> str:
    """
    Enhance the generated Args class with boilerplate constants.
    
    This function adds:
    1. DEFAULT_FILENAME constant
    2. TEMPLATE_DESCRIPTION constant
    """
    # Generate a default filename based on document type
    default_filename = document_type.lower().replace(' ', '_').replace('-', '_')
    
    # Generate a template description
    template_description = f"A {document_type} template for creating professional documents."
    
    # Add the constants before the Args class
    constants = f'''DEFAULT_FILENAME = "{default_filename}"
TEMPLATE_DESCRIPTION = "{template_description}"

'''
    
    return constants + args_code


def create_args_tool(document_type: str) -> Any:
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
        # Enhance the Args code with boilerplate constants
        enhanced_args_code = _enhance_args_class(args_code, document_type)
        
        # Verify the Args class with the documents service
        try:
            documents_service_url = os.getenv("DOCUMENTS_SERVICE_URL")
            if not documents_service_url:
                raise RuntimeError("DOCUMENTS_SERVICE_URL not configured")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{documents_service_url}/verify-args",
                    json={"args_code": enhanced_args_code}
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        if not result.get("valid", False):
                            raise RuntimeError(f"Args validation failed: {result.get('message', 'Unknown error')}")
                        logger.info("✓ Args class validation passed")
                    else:
                        raise RuntimeError(f"Args validation request failed with status {response.status}")
        except Exception as e:
            logger.error(f"Args validation failed: {e}")
            raise RuntimeError(f"Args class validation failed: {str(e)}")
        
        # Store the enhanced code
        document_results['args_code'] = enhanced_args_code
        document_progress['args_code'] = True
        logger.info(f"✓ Generated and enhanced Args class with {len(re.findall(r'def __init__|class Args', enhanced_args_code))} definitions")
        return f"Generated and enhanced Args class with {len(re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*:', enhanced_args_code))} fields"
    
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
        # Process and enhance the generated code with boilerplate
        enhanced_render_code = _enhance_render_function(render_code)
        
        # Verify the render function with the documents service
        try:
            documents_service_url = os.getenv("DOCUMENTS_SERVICE_URL")
            if not documents_service_url:
                raise RuntimeError("DOCUMENTS_SERVICE_URL not configured")
            
            # If we have both args_code and render_code, pass the full template for verification
            args_code = document_results.get('args_code', '')
            if args_code:
                full_template = args_code + '\n\n' + enhanced_render_code
                payload = {"full_template": full_template}
            else:
                payload = {"render_code": enhanced_render_code}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{documents_service_url}/verify-render",
                    json=payload
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        if not result.get("valid", False):
                            raise RuntimeError(f"Render validation failed: {result.get('message', 'Unknown error')}")
                        logger.info("✓ Render function validation passed")
                    else:
                        raise RuntimeError(f"Render validation request failed with status {response.status}")
        except Exception as e:
            logger.error(f"Render validation failed: {e}")
            raise RuntimeError(f"Render function validation failed: {str(e)}")
        
        # Store the enhanced code
        document_results['render_code'] = enhanced_render_code
        document_progress['render_code'] = True
        lines = enhanced_render_code.split('\n')
        logger.info(f"✓ Generated and enhanced render function with {len(lines)} lines")
        return f"Generated and enhanced render function with {len(lines)} lines of code"
    
    return function_tool(generate_render_function)


# Global storage for document generation results
document_results: Dict[str, Any] = {}
document_progress: Dict[str, bool] = {}


async def run_document_agent(
    document_type: str,
    document_structure: str,
    context: Optional[str] = None,
    input_items: Optional[list[Any]] = None
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
        create_args_tool(document_type),
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
    
    # Prepare input for the agent
    logger.info(f"Received input_items: {len(input_items) if input_items else 0} items")
    
    if not input_items:
        # Fallback to text-only input
        logger.info("Using fallback text input")
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
        input_items = [{"role": "user", "content": input_text}]
    
    with trace("Document Generation Agent"):
        # Use streamed runner for better progress visibility
        streamed_result = Runner.run_streamed(agent_instance, input=input_items)
        
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
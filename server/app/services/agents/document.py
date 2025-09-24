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


def _lint_latex_strings(src: str) -> None:
    """Quick unit guard to catch obvious backslash mistakes."""
    import re

    # Fail if we see 6+ consecutive backslashes anywhere (almost certainly wrong)
    if re.search(r'\\\\\\\\\\\\+', src):
        raise RuntimeError("Suspicious 6+ backslashes found; likely double-escaped newline.")
    
    # Note: Removed the '\\\\text' check as it false-positives on valid generator strings like r'\\textbf'


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
from typing import Optional, List, Dict, Any, Union

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


# Helper constants for consistent LaTeX formatting
BR = NoEscape(r'\\\\')
def VSPACE(cm: str) -> NoEscape: return NoEscape(r'\\vspace{' + cm + r'}')
def B(s: str) -> NoEscape: return NoEscape(r'\\textbf{' + _escape_latex(s) + r'}')


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
    doc_building_end = len(core_logic_lines)
    for i, line in enumerate(core_logic_lines):
        line_lower = line.lower().strip()
        # Look for compilation-related code that we want to replace
        if any(keyword in line_lower for keyword in ['generate_pdf', 'generate_tex', 'temporarydirectory', 'pdf_bytes', 'temp_dir', 'pass']):
            doc_building_end = i
            break
    
    # Extract the document building logic (exclude the 'pass' or placeholder lines)
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


def create_template_tool(document_type: str) -> Any:
    """Create a function tool for generating both Args class and render function."""
    
    async def generate(
        args_code: str = Field(description="Complete Python code for the Args class (pydantic BaseModel) with all required fields and descriptions"),
        render_code: str = Field(description="Complete Python code for the render(args: Args) -> bytes function using PyLaTeX")
    ) -> str:
        """Generate both the Args class and render function for the document template.
        
        This function should output complete Python code for:
        1. Args class: A pydantic BaseModel with all fields needed for the document template
        2. Render function: A function that takes an Args instance and returns PDF bytes
        
        Args:
            args_code: Complete Python class definition for Args
            render_code: Complete Python function definition for render
            
        Returns:
            Confirmation message
        """
        # Enhance both codes with boilerplate
        enhanced_args_code = _enhance_args_class(args_code, document_type)
        enhanced_render_code = _enhance_render_function(render_code)
        
        # Fix common LaTeX escaping issues with surgical normalization
        import re

        # REMOVED: The three broad regex lines that were risky and could mangle valid sequences
        # Optional: narrowly normalize only line-break literals inside NoEscape raw strings,
        # avoiding control sequences (\textbf, \vspace, \alpha, etc.)
        enhanced_render_code = re.sub(
            r"(NoEscape\(\s*r([\"']))\\\\{3,}(?![A-Za-z@])",  # 3+ backslashes not followed by a letter/@ (so not \textbf)
            r"\1\\\\",                                        # force exactly two backslashes
            enhanced_render_code
        )
        
        # Quick unit guard to catch obvious mistakes
        _lint_latex_strings(enhanced_render_code)
        
        # Verify both together with the documents service
        try:
            documents_service_url = os.getenv("DOCUMENTS_SERVICE_URL")
            if not documents_service_url:
                raise RuntimeError("DOCUMENTS_SERVICE_URL not configured")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{documents_service_url}/verify",
                    json={
                        "args_code": enhanced_args_code,
                        "render_code": enhanced_render_code
                    }
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        if not result.get("valid", False):
                            # Extract detailed error information
                            error_message = result.get('message', 'Unknown error')
                            error_type = result.get('error_type', 'UnknownError')
                            error_details = result.get('error_details', '')
                            
                            # Create a comprehensive error message
                            detailed_error = f"Template validation failed: {error_message}"
                            if error_type and error_type != 'UnknownError':
                                detailed_error += f" (Type: {error_type})"
                            if error_details and error_details != error_message:
                                detailed_error += f"\nDetails: {error_details}"
                            
                            raise RuntimeError(detailed_error)
                        logger.info("✓ Template validation passed")
                    else:
                        # Try to get error details from the response body
                        try:
                            error_response = await response.json()
                            error_message = error_response.get('message', f'HTTP {response.status} error')
                            error_type = error_response.get('error_type', 'HTTPError')
                            error_details = error_response.get('error_details', '')
                            
                            detailed_error = f"Template validation request failed: {error_message}"
                            if error_type and error_type != 'HTTPError':
                                detailed_error += f" (Type: {error_type})"
                            if error_details and error_details != error_message:
                                detailed_error += f"\nDetails: {error_details}"
                            
                            raise RuntimeError(detailed_error)
                        except Exception as parse_error:
                            # Try to get response text as fallback
                            try:
                                response_text = await response.text()
                                raise RuntimeError(f"Template validation request failed with status {response.status}. Response: {response_text}")
                            except:
                                # Final fallback if we can't parse the error response
                                raise RuntimeError(f"Template validation request failed with status {response.status}. Parse error: {parse_error}")
        except Exception as e:
            logger.error(f"Template validation failed: {e}")
            raise RuntimeError(f"Template validation failed: {str(e)}")
        
        # Store both enhanced codes
        document_results['args_code'] = enhanced_args_code
        document_results['render_code'] = enhanced_render_code
        document_progress['args_code'] = True
        document_progress['render_code'] = True
        
        args_fields = len(re.findall(r'[a-zA-Z_][a-zA-Z0-9_]*:', enhanced_args_code))
        render_lines = len(enhanced_render_code.split('\n'))
        
        logger.info(f"✓ Generated and enhanced template with {args_fields} Args fields and {render_lines} render lines")
        return f"Generated and enhanced template with {args_fields} Args fields and {render_lines} render lines"
    
    return function_tool(generate)


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
    
    # Create single tool for the agent
    tools = [
        create_template_tool(document_type)
    ]
    
    # Create tool use behavior to wait for the template tool to be called
    def tool_use_behavior(context: Any, tool_results: list[Any]) -> ToolsToFinalOutputResult:
        # We require the template tool to be called (which handles both args and render)
        completed_required = document_progress.get('args_code', False) and document_progress.get('render_code', False)
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
    
    # Check if template generation was completed
    args_completed = document_progress.get('args_code', False)
    render_completed = document_progress.get('render_code', False)
    logger.info(f"Document generation completed: Args={args_completed}, Render={render_completed}")
    
    if not (args_completed and render_completed):
        missing_parts = []
        if not args_completed:
            missing_parts.append("Args class")
        if not render_completed:
            missing_parts.append("Render function")
        logger.warning(f"Missing template parts: {missing_parts}")
        raise RuntimeError(f"Document generation incomplete - missing: {missing_parts}")
    
    return {
        'args_code': document_results.get('args_code', ''),
        'render_code': document_results.get('render_code', ''),
        'document_type': document_type
    }
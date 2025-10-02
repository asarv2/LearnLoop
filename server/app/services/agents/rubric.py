import logging
import re
from typing import Any

from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from app.extensions import load_prompt
from app.services.agents.generic import GenericAgent
from pydantic import Field

logger = logging.getLogger(__name__)


def create_safe_field_name(standard_name: str) -> str:
    """
    Create a safe field name from a standard name by removing special characters and spaces.

    Args:
        standard_name: The name from the standard

    Returns:
        Safe field name for use in Pydantic models
    """
    safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", standard_name.lower())
    safe_name = re.sub(r"_+", "_", safe_name).strip("_")
    return safe_name


# Global storage for rubric completion results
rubric_results: dict[str, Any] = {}
rubric_progress: dict[str, bool] = {}


def create_standard_completion_function(
    standard_name: str, num_levels: int = 5
) -> Any:
    """Create a function tool for completing a specific standard."""
    safe_name = create_safe_field_name(standard_name)

    # Build description
    criteria_description = f"Array of {num_levels} criteria descriptions for {standard_name}, from level 1 (lowest) to level {num_levels} (highest)"

    async def complete_standard(
        criteria: list[str] = Field(
            description=criteria_description,
            min_length=num_levels,
            max_length=num_levels,
        ),
    ) -> str:
        f"""Complete the rubric standard: {standard_name}
        
        This function generates the detailed criteria for each score level of the standard: {standard_name}
        
        Args:
            criteria: Array of {num_levels} strings, each describing the performance criteria for that level (1-{num_levels})
            
        Returns:
            Confirmation message of the completion
        """
        # Ensure we have exactly the right number of levels
        if len(criteria) != num_levels:
            logger.warning(
                f"Expected {num_levels} criteria for {standard_name}, got {len(criteria)}. Adjusting..."
            )
            # Pad or truncate as needed
            while len(criteria) < num_levels:
                criteria.append("")
            criteria = criteria[:num_levels]

        rubric_results[safe_name] = {"name": standard_name, "items": criteria}
        rubric_progress[safe_name] = True

        logger.info(
            f"✓ Completed standard {standard_name}: {num_levels} levels defined"
        )
        return f"Completed {standard_name} with {num_levels} criteria levels"

    # Set the function name dynamically
    complete_standard.__name__ = f"complete_{safe_name}"

    # Apply the function_tool decorator
    return function_tool(complete_standard)


def create_rubric_completion_tools(
    standards: list[dict[str, str]], num_levels: int = 5
) -> list[Any]:
    """Create all rubric completion function tools for the standards.

    Args:
        standards: List of standard dictionaries with 'name' and optional 'description'
        num_levels: Number of score levels (default 5)

    Returns:
        List of function tools for completing each standard
    """
    tools = []

    # Create tools for each standard
    for standard in standards:
        standard_name = standard.get("name", "")
        if not standard_name:
            logger.warning("Skipping standard with empty name")
            continue

        tool = create_standard_completion_function(standard_name, num_levels)
        tools.append(tool)
        logger.info(f"Created completion tool for standard: {standard_name}")

    logger.info(f"Total rubric completion tools created: {len(tools)}")
    return tools


async def get_rubric_prompt(standards: list[dict[str, str]] | None = None) -> str:
    """Read the rubric prompt from the markdown file and optionally add dynamic tool information."""
    base_prompt = await load_prompt("rubric")

    if standards:
        # Add dynamic tool information to the prompt
        tool_descriptions = []

        # Add standard completion tools
        for standard in standards:
            standard_name = standard.get("name", "")
            if standard_name:
                safe_name = create_safe_field_name(standard_name)
                standard_desc = standard.get("description", "")
                desc_text = (
                    f" - {standard_desc[:100]}..." if standard_desc else ""
                )
                tool_descriptions.append(
                    f"- `complete_{safe_name}`: Complete the criteria for '{standard_name}'{desc_text}"
                )

        dynamic_section = f"""
## Available Tools for This Rubric

You have access to the following tools to complete the rubric:

{chr(10).join(tool_descriptions)}

**CRITICAL**: You must call ALL available tools to complete the task:
- All standard completion tools (one for each rubric criterion) (required)

## 🔥 FINAL CHECKLIST

**Before submitting your response, verify you have called:**
{chr(10).join([f"{i+1}. ✅ `complete_{create_safe_field_name(s.get('name', ''))}`" for i, s in enumerate(standards) if s.get('name')])}

**If you skip ANY of these tools, your task is incomplete!**

## Standards to Complete

"""
        # Build standards list
        standards_list = []
        for i, s in enumerate(standards):
            standard_name = s.get('name', 'Unnamed Standard')
            standard_desc = s.get('description', '')
            standard_text = f"### {i+1}. {standard_name}"
            if standard_desc:
                standard_text += f"\n{standard_desc}"
            standards_list.append(standard_text)
        
        dynamic_section += "\n".join(standards_list) + "\n\n"

        # Insert the dynamic section after the base prompt
        return base_prompt + dynamic_section

    return base_prompt


async def run_rubric_generation_agent(
    rubric_name: str,
    rubric_description: str,
    standards: list[dict[str, str]],
    num_levels: int = 5,
) -> dict[str, Any]:
    """
    Run the rubric generation agent to auto-complete rubric criteria.

    Args:
        rubric_name: The name of the rubric
        rubric_description: Description of the rubric's purpose
        standards: List of standard dictionaries with 'name' and optional 'description'
        num_levels: Number of score levels (default 5)

    Returns:
        A dictionary with completed standards, each containing 'name' and 'items' (array of criteria)
    """
    try:
        # Clear previous results
        global rubric_results, rubric_progress
        rubric_results.clear()
        rubric_progress.clear()

        logger.info(
            f"Starting rubric generation for '{rubric_name}' with {len(standards)} standards"
        )

        # Create rubric completion tools
        completion_tools = create_rubric_completion_tools(standards, num_levels)
        logger.info(f"Created {len(completion_tools)} completion tools")

        # Create tool use behavior to wait for all tools to be called
        def tool_use_behavior(
            context: Any, tool_results: list[Any]
        ) -> ToolsToFinalOutputResult:
            # Build list of required tools based on standards
            required_tools = []

            # Add standard completion tools to required tools (using safe field names)
            for standard in standards:
                standard_name = standard.get("name", "")
                if standard_name:
                    safe_name = create_safe_field_name(standard_name)
                    required_tools.append(safe_name)

            # Check if all required tools have been called
            completed_required = all(
                rubric_progress.get(tool, False) for tool in required_tools
            )
            logger.info(
                f"Tool use behavior check: required_tools={required_tools}, completed_required={completed_required}, rubric_progress={rubric_progress}"
            )
            return ToolsToFinalOutputResult(is_final_output=completed_required)

        system_prompt = await get_rubric_prompt(standards)

        # Create rubric generation agent
        rubric_agent = GenericAgent(
            agent_name="Rubric Generation Agent",
            system_prompt=system_prompt,
            temperature=0.7,  # Slightly higher for creative rubric generation
            tools=completion_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
            model="xai/grok-4-fast-non-reasoning",
        )

        agent_instance = rubric_agent.agent()

        # Prepare input with rubric context
        rubric_context = f"""
# Rubric: {rubric_name}

**Description:** {rubric_description or "No description provided"}

**Number of Score Levels:** {num_levels}

**Standards to Complete:** {len(standards)}

Please generate detailed, specific criteria for each score level (1-{num_levels}) for all {len(standards)} standards.
Each criterion should clearly describe what performance looks like at that level.

Remember to call ALL completion tools - one for each standard!
"""

        input_items = [{"role": "user", "content": rubric_context}]

        # Run the rubric generation agent
        logger.info("Running rubric generation agent...")
        with trace(f"Rubric Generation: {rubric_name}"):
            # Use streamed runner for better progress visibility
            streamed_result = Runner.run_streamed(agent_instance, input=input_items)

            # Process streaming events
            async for event in streamed_result.stream_events():
                # You can add event handling here if needed for progress tracking
                pass

        logger.info("Rubric generation agent completed successfully")

        # Check if all tools were called
        expected_tools = len(standards)
        completed_tools = len(rubric_progress)
        logger.info(
            f"Rubric generation completed: {completed_tools}/{expected_tools} tools called"
        )
        logger.info(f"Rubric progress details: {rubric_progress}")

        if completed_tools < expected_tools:
            # Build list of expected tool names
            expected_tool_names = []
            for standard in standards:
                standard_name = standard.get("name", "")
                if standard_name:
                    safe_name = create_safe_field_name(standard_name)
                    expected_tool_names.append(safe_name)

            missing_tools = [
                name
                for name in expected_tool_names
                if not rubric_progress.get(name, False)
            ]
            logger.warning(f"Missing tool calls for: {missing_tools}")
            logger.warning(f"Expected tools: {expected_tool_names}")
            logger.warning(f"Completed tools: {list(rubric_progress.keys())}")

        # Extract results from the global storage
        completed_standards = []
        for standard in standards:
            standard_name = standard.get("name", "")
            if not standard_name:
                continue

            safe_name = create_safe_field_name(standard_name)
            standard_data = rubric_results.get(safe_name, {})

            completed_standards.append(
                {
                    "name": standard_name,
                    "description": standard.get("description", ""),
                    "items": standard_data.get("items", [""] * num_levels),
                }
            )

        logger.info(f"Rubric generation completed with {len(completed_standards)} standards")

        return {
            "success": True,
            "standards": completed_standards,
            "message": "Rubric generated successfully",
        }

    except Exception as e:
        logger.error(f"Error in run_rubric_generation_agent: {str(e)}", exc_info=True)
        raise


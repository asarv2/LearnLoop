import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

from agents import Runner, ToolsToFinalOutputResult, function_tool, trace
from app.db import get_session
from app.extensions import load_prompt
from app.models import (Chats, Messages, RubricGrades, Rubrics, StandardGrades,
                        Standards)
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_conversation_history, get_dynamic_rubric
from pydantic import Field
from sqlmodel import Session, select

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


# Global storage for grading results
grading_results: Dict[str, Any] = {}
grading_progress: Dict[str, bool] = {}


def create_grading_function(standard: Standards) -> Any:
    """Create a function tool for a specific standard."""
    safe_name = create_safe_field_name(standard.name)
    
    # Build description with standard details
    standard_description = standard.description or "No description available"
    score_description = f"Score for {standard.name} (1-5) - {standard_description}"
    feedback_description = f"Feedback for {standard.name} - {standard_description}"
    
    async def grade_standard(
        score: int = Field(ge=1, le=5, description=score_description),
        feedback: str = Field(default="", description=feedback_description)
    ) -> str:
        f"""Grade the conversation on the standard: {standard.name}
        
        Standard Description: {standard_description}
        
        This function evaluates the conversation against the standard: {standard.name}
        
        Args:
            score: Integer score from 1-5 based on the rubric criteria
            feedback: Brief feedback explaining the score
            
        Returns:
            Confirmation message of the grading
        """
        grading_results[safe_name] = {
            'score': score,
            'feedback': feedback
        }
        grading_progress[safe_name] = True
        logger.info(f"✓ Graded {standard.name}: {score}/5 - {feedback[:50]}...")
        return f"Graded {standard.name} with score {score}"
    
    # Set the function name dynamically
    grade_standard.__name__ = f"grade_{safe_name}"
    
    # Apply the function_tool decorator
    return function_tool(grade_standard)


def create_strengths_function() -> Any:
    """Create a function tool for identifying strengths."""
    
    async def identify_strengths(
        strengths: List[str] = Field(description="List of key strengths observed in the conversation")
    ) -> str:
        """Identify the main strengths demonstrated in the conversation.
        
        Args:
            strengths: List of key strengths with specific examples
            
        Returns:
            Confirmation message
        """
        grading_results['strengths'] = strengths
        grading_progress['strengths'] = True
        logger.info(f"✓ Identified {len(strengths)} strengths: {[s[:30] + '...' if len(s) > 30 else s for s in strengths[:3]]}")
        return f"Identified {len(strengths)} strengths"
    
    return function_tool(identify_strengths)


def create_improvements_function() -> Any:
    """Create a function tool for identifying areas for improvement."""
    
    async def identify_improvements(
        improvements: List[str] = Field(description="List of areas for improvement in the conversation")
    ) -> str:
        """Identify areas where the conversation could be improved.
        
        Args:
            improvements: List of specific areas for improvement with suggestions
            
        Returns:
            Confirmation message
        """
        grading_results['improvements'] = improvements
        grading_progress['improvements'] = True
        logger.info(f"✓ Identified {len(improvements)} improvements: {[i[:30] + '...' if len(i) > 30 else i for i in improvements[:3]]}")
        return f"Identified {len(improvements)} improvements"
    
    return function_tool(identify_improvements)


def create_summary_function() -> Any:
    """Create a function tool for generating an overall summary."""
    
    async def generate_summary(
        summary: str = Field(description="Overall summary of the participant's performance, highlighting key strengths and areas for improvement")
    ) -> str:
        """Generate an overall summary of the participant's performance.
        
        Args:
            summary: Comprehensive summary that synthesizes the evaluation results
            
        Returns:
            Confirmation message
        """
        grading_results['summary'] = summary
        grading_progress['summary'] = True
        logger.info(f"✓ Generated summary: {summary[:100]}...")
        return f"Generated overall summary"
    
    return function_tool(generate_summary)


def create_grading_tools(standards: List[Standards]) -> List[Any]:
    """Create all grading function tools for the standards plus strengths/improvements/summary."""
    tools = []
    
    # Create tools for each standard
    for standard in standards:
        tool = create_grading_function(standard)
        tools.append(tool)
        standard_desc = standard.description or "No description"
        logger.info(f"Created grading tool for standard: {standard.name} - {standard_desc[:100]}...")
    
    # Add strengths, improvements, and summary tools
    tools.append(create_strengths_function())
    tools.append(create_improvements_function())
    tools.append(create_summary_function())
    logger.info(f"Created strengths, improvements, and summary tools")
    
    logger.info(f"Total tools created: {len(tools)}")
    return tools


async def get_grade_prompt(standards: Optional[List[Standards]] = None) -> str:
    """Read the grade prompt from the markdown file and optionally add dynamic tool information."""
    base_prompt = await load_prompt("grade")
    
    if standards:
        # Add dynamic tool information to the prompt
        tool_descriptions = []
        
        # Add standard grading tools
        for standard in standards:
            safe_name = create_safe_field_name(standard.name)
            tool_descriptions.append(f"- `grade_{safe_name}`: Grade the conversation on {standard.name} (1-5 score + feedback)")
        
        # Add fixed tools
        tool_descriptions.append("- `identify_strengths`: Identify key strengths demonstrated in the conversation")
        tool_descriptions.append("- `identify_improvements`: Identify areas for improvement with specific suggestions")
        tool_descriptions.append("- `generate_summary`: Generate an overall summary of the participant's performance")
        
        dynamic_section = f"""
## Available Tools for This Evaluation

You have access to the following tools to complete the evaluation:

{chr(10).join(tool_descriptions)}

**CRITICAL**: You must call ALL available tools to complete the task:
- All standard grading tools (one for each rubric criterion) (required)
- `identify_strengths` (required)
- `identify_improvements` (required)
- `generate_summary` (required)

## 🔥 FINAL CHECKLIST

**Before submitting your response, verify you have called:**
{chr(10).join([f"{i+1}. ✅ `grade_{create_safe_field_name(standard.name)}`" for i, standard in enumerate(standards)])}
{len(standards) + 1}. ✅ `identify_strengths`
{len(standards) + 2}. ✅ `identify_improvements`
{len(standards) + 3}. ✅ `generate_summary`

**If you skip ANY of these tools, your task is incomplete!**

"""
        
        # Insert the dynamic section after the base prompt
        return base_prompt + dynamic_section
    
    return base_prompt


async def run_grading_agent(
    chat_id: uuid.UUID,
    rubric_id: uuid.UUID,
    session: Session,
) -> str:
    """
    This function is used to run the grading agent for assessment chats.
    Returns a string of the rubric_grade id.

    Args:
        chat_id: The ID of the chat
        rubric_id: The ID of the rubric to use for grading

    Returns:
        A string of the rubric_grade id.
    """
    try:
        # Clear previous results
        global grading_results, grading_progress
        grading_results.clear()
        grading_progress.clear()
        
        # Get the chat from the chat_id
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one()
        if not chat:
            raise ValueError(f"Chat not found with ID {chat_id}")

        # Get all the messages for the chat_id, order by created_at
        messages = session.exec(
            select(Messages).where(Messages.chat_id == chat_id)
        ).all()

        messages = list(messages)
        messages = sorted(messages, key=lambda x: x.created_at)

        # Prepare conversation history from chat_id
        conversation_history = get_conversation_history(messages)

        # Get rubric from rubric_id
        rubric = session.exec(select(Rubrics).where(Rubrics.id == rubric_id)).one()
        if not rubric:
            raise ValueError(f"Rubric not found with ID {rubric_id}")

        # Get standards from rubric
        standards = session.exec(
            select(Standards).where(Standards.rubric_id == rubric_id)
        ).all()
        if not standards:
            raise ValueError(f"No standards found for rubric {rubric_id}")

        logger.info(
            f"Starting parallel grading for chat {chat_id} with rubric {rubric.name}"
        )
        logger.info(f"Found {len(standards)} standards")

        # Build rubric input using utility function
        rubric_input = get_dynamic_rubric(rubric, list(standards))

        # Create grading tools
        grading_tools = create_grading_tools(list(standards))
        logger.info(f"Created {len(grading_tools)} grading tools")
        
        # Create tool use behavior to wait for all tools to be called
        def tool_use_behavior(context: Any, tool_results: list[Any]) -> ToolsToFinalOutputResult:
            # Build list of required tools based on standards and fixed tools
            required_tools = ['strengths', 'improvements', 'summary']
            
            # Add standard grading tools to required tools (using safe field names)
            for standard in standards:
                safe_name = create_safe_field_name(standard.name)
                required_tools.append(safe_name)
            
            # Check if all required tools have been called
            completed_required = all(grading_progress.get(tool, False) for tool in required_tools)
            logger.info(f"Tool use behavior check: required_tools={required_tools}, completed_required={completed_required}, grading_progress={grading_progress}")
            return ToolsToFinalOutputResult(is_final_output=completed_required)

        system_prompt = await get_grade_prompt(list(standards))

        # Create grading agent with parallel tool calls
        grading_agent = GenericAgent(
            agent_name="Parallel Grading Agent",
            system_prompt=system_prompt,
            temperature=0.0,
            tools=grading_tools,
            parallel_tool_calls=True,
            tool_use_behavior=tool_use_behavior,
            model="gpt-4.1",
        )

        agent_instance = grading_agent.agent()

        # Prepare input with rubric and conversation history
        input_items = [rubric_input] + conversation_history

        # Run the grading with parallel tool calls
        logger.info("Running parallel grading agent...")
        with trace(chat.title, trace_id=chat.trace_id, group_id=str(chat_id)):
            result = await Runner.run(agent_instance, input=input_items)

        logger.info("Parallel grading agent completed successfully")
        
        # Check if all tools were called
        expected_tools = len(standards) + 3  # standards + strengths + improvements + summary
        completed_tools = len(grading_progress)
        logger.info(f"Grading completed: {completed_tools}/{expected_tools} tools called")
        logger.info(f"Grading progress details: {grading_progress}")
        
        if completed_tools < expected_tools:
            # Build list of expected tool names
            expected_tool_names = ['strengths', 'improvements', 'summary']
            for standard in standards:
                safe_name = create_safe_field_name(standard.name)
                expected_tool_names.append(safe_name)
            
            missing_tools = [name for name in expected_tool_names if not grading_progress.get(name, False)]
            logger.warning(f"Missing tool calls for: {missing_tools}")
            logger.warning(f"Expected tools: {expected_tool_names}")
            logger.warning(f"Completed tools: {list(grading_progress.keys())}")
        
        # Extract results from the global storage
        grading_result = grading_results

        # Calculate time taken - ensure both times are in UTC
        current_time = datetime.now(timezone.utc)
        chat_created_at = chat.created_at

        # Convert chat_created_at to UTC if it has timezone info
        if chat_created_at.tzinfo is not None:
            chat_created_at = chat_created_at.astimezone(timezone.utc)
        else:
            # If timezone-naive, assume it's already UTC and make it timezone-aware
            chat_created_at = chat_created_at.replace(tzinfo=timezone.utc)

        # Now both times are timezone-aware and in UTC
        time_taken = max(1, int((current_time - chat_created_at).total_seconds()))
        logger.info(
            f"Time calculation: current={current_time}, created={chat_created_at}, taken={time_taken}s"
        )

        # Get strengths and improvements from the results (now as arrays)
        strengths_list = grading_result.get('strengths', [])
        improvements_list = grading_result.get('improvements', [])
        overall_summary = grading_result.get('summary', '')
        
        # Ensure they are lists
        if not isinstance(strengths_list, list):
            strengths_list = []
        if not isinstance(improvements_list, list):
            improvements_list = []
        
        # Use the generated summary for description field, fallback to concatenated sections if no summary
        if overall_summary:
            summary = overall_summary
        else:
            # Fallback: Create overall summary for description field
            summary_parts = []
            if strengths_list:
                summary_parts.append(f"Strengths: {'; '.join(strengths_list)}")
            if improvements_list:
                summary_parts.append(f"Areas for Improvement: {'; '.join(improvements_list)}")
            summary = "\n\n".join(summary_parts) if summary_parts else "Grading completed"

        # Create standard grade records for each standard and calculate total score
        standard_grade_count = 0
        score = 0
        standard_grades_to_add = []
        
        for standard in standards:
            # Create safe field names (same logic as in model creation)
            safe_name = create_safe_field_name(standard.name)

            try:
                # Get the score and feedback from the grading results
                standard_data = grading_result.get(safe_name, {})
                standard_score = standard_data.get('score', 0)
                standard_feedback = standard_data.get('feedback', '')

                # Ensure standard_score is a valid integer
                if not isinstance(standard_score, (int, float)):
                    logger.warning(f"Invalid standard score type for {standard.name}: {type(standard_score)}, value: {standard_score}. Defaulting to 0.")
                    standard_score = 0
                else:
                    standard_score = int(standard_score)  # Ensure it's an integer

                logger.info(
                    f"Standard {standard.name}: score={standard_score}, feedback_length={len(standard_feedback)}"
                )

                # Store standard grade data for later creation
                standard_grades_to_add.append({
                    'standard_id': standard.id,
                    'name': standard.name,
                    'score': standard_score,
                    'description': standard_feedback,
                })
                standard_grade_count += 1
                score += standard_score
            except Exception as e:
                logger.error(
                    f"Failed to get grading data for standard {standard.name}: {e}"
                )
                continue

        # Ensure score is a valid integer
        if not isinstance(score, (int, float)):
            logger.warning(f"Invalid score type: {type(score)}, value: {score}. Defaulting to 0.")
            score = 0
        else:
            score = int(score)  # Ensure it's an integer
        
        # Create the rubric grade record with calculated score
        logger.info(f"Creating rubric grade with score: {score}, name: {rubric.name}")
        logger.info(f"Strengths list: {strengths_list}")
        logger.info(f"Improvements list: {improvements_list}")
        rubric_grade = RubricGrades(
            chat_id=chat_id,
            name=rubric.name,
            description=summary,
            score=score,  # Set the score here
            strengths=strengths_list,  # Use dedicated strengths field
            improvements=improvements_list,  # Use dedicated improvements field
        )

        session.add(rubric_grade)
        logger.info("Flushing rubric grade to get ID...")
        session.flush()  # Get the ID without committing
        logger.info(f"Rubric grade created with ID: {rubric_grade.id}")

        # Now create the standard grade records
        for standard_grade_data in standard_grades_to_add:
            standard_grade = StandardGrades(
                rubric_grade_id=rubric_grade.id,
                standard_id=standard_grade_data['standard_id'],
                name=standard_grade_data['name'],
                score=standard_grade_data['score'],
                description=standard_grade_data['description'],
            )
            session.add(standard_grade)

        logger.info(f"Created {standard_grade_count} standard grade records")

        # Mark chat as completed if not already
        if not chat.completed:
            chat.completed = True
            chat.completed_at = current_time
            session.add(chat)

        # Commit all changes
        session.commit()
        session.refresh(rubric_grade)

        logger.info(
            f"Grading completed successfully with grade ID: {rubric_grade.id}"
        )
        return str(rubric_grade.id)

    except Exception as e:
        logger.error(f"Error in run_grading_agent: {str(e)}", exc_info=True)
        session.rollback()
        raise

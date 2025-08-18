import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List

from agents import Runner, trace
from anyio import Path
from app.db import get_session
from app.models import (Assessments, Chats, Messages, RubricGrades, Rubrics,
                        StandardGrades, Standards)
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_conversation_history, get_dynamic_rubric
from pydantic import BaseModel, Field, create_model
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


def create_dynamic_rubric_model(standards: List[Standards]) -> type[BaseModel]:
    """
    Create a dynamic Pydantic model based on the rubric's standards.

    Args:
        standards: List of standards for this rubric

    Returns:
        Dynamic Pydantic model class
    """
    fields: dict[str, Any] = {}

    for standard in standards:
        # Create safe field names by removing special characters and spaces
        safe_name = create_safe_field_name(standard.name)

        # Create field for the score (1-5)
        score_field_name = f"{safe_name}_score"
        fields[score_field_name] = (
            int,
            Field(ge=1, le=5, description=f"Score for {standard.name} (1-5)"),
        )

        # Create field for the feedback
        feedback_field_name = f"{safe_name}_feedback"
        fields[feedback_field_name] = (
            str,
            Field(description=f"Feedback for {standard.name}"),
        )

    # Add overall fields
    fields["summary"] = (str, Field(description="Overall summary of the grading"))

    return create_model("DynamicRubricGrade", **fields)  # type: ignore


async def get_grade_prompt() -> str:
    """Read the grade prompt from the markdown file."""
    prompt_path = Path(__file__).parent.parent.parent / "lib" / "prompts" / "grade.md"
    try:
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        logger.error(f"Grade prompt file not found at {prompt_path}")
        raise
    except Exception as e:
        logger.error(f"Error reading grade prompt: {str(e)}")
        raise


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

        # Get the assessment to find the rubric
        assessment = session.exec(
            select(Assessments).where(Assessments.chat_id == chat_id)
        ).one()
        if not assessment:
            raise ValueError(f"No assessment found for chat {chat_id}")

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
            f"Starting grading for chat {chat_id} with rubric {rubric.name}"
        )
        logger.info(f"Found {len(standards)} standards")

        # Build dynamic rubric using utility function
        rubric_input = get_dynamic_rubric(rubric, list(standards))

        # Create dynamic Pydantic model for the rubric
        DynamicRubric = create_dynamic_rubric_model(list(standards))

        # Log the expected field names for debugging
        expected_fields = []
        for standard in standards:
            safe_name = create_safe_field_name(standard.name)
            expected_fields.extend([f"{safe_name}_score", f"{safe_name}_feedback"])
        logger.info(f"Expected model fields: {expected_fields}")

        system_prompt = await get_grade_prompt()

        # Create a simple grading agent
        grading_agent = GenericAgent(
            agent_name="Grading Agent",
            system_prompt=system_prompt,
            temperature=0.0,
            output_type=DynamicRubric,
        )

        agent_instance = grading_agent.agent()

        # Prepare input with rubric and conversation history
        input_items = [rubric_input] + conversation_history

        # Run the grading
        logger.info("Running grading agent...")
        with trace(chat.title, trace_id=chat.trace_id, group_id=str(assessment.id)):
            result = await Runner.run(agent_instance, input=input_items)

        grading_result = result.final_output_as(DynamicRubric)
        logger.info("Grading agent completed successfully")

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

        # get overall summary
        summary = getattr(grading_result, "summary", "")

        # Create standard grade records for each standard and calculate total score
        standard_grade_count = 0
        score = 0
        standard_grades_to_add = []
        
        for standard in standards:
            # Create safe field names (same logic as in model creation)
            safe_name = create_safe_field_name(standard.name)

            # Get the score and feedback for this standard
            score_field = f"{safe_name}_score"
            feedback_field = f"{safe_name}_feedback"

            try:
                standard_score = getattr(grading_result, score_field, 0)
                standard_feedback = getattr(grading_result, feedback_field, "")

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
            except AttributeError as e:
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
        rubric_grade = RubricGrades(
            chat_id=chat_id,
            name=rubric.name,
            description=summary,
            score=score,  # Set the score here
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

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, List

from agents import Runner, trace
from app.db import get_session
from app.models import (
    Models,
    Providers,
    Rubrics,
    SimulationAttempts,
    SimulationChatFeedbacks,
    SimulationChatGrades,
    SimulationChats,
    SimulationMessages,
    Simulations,
    StandardGroups,
    Standards,
    Agents,
)
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_simulation_conversation_history
from app.utils.rubric import get_dynamic_rubric
from fastapi import Depends
from pydantic import BaseModel, Field, create_model
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def create_safe_field_name(short_name: str) -> str:
    """
    Create a safe field name from a short_name by removing special characters and spaces.

    Args:
        short_name: The short name from the standard group

    Returns:
        Safe field name for use in Pydantic models
    """
    safe_name = re.sub(r"[^a-zA-Z0-9_]", "_", short_name.lower())
    safe_name = re.sub(r"_+", "_", safe_name).strip("_")
    return safe_name


def create_dynamic_rubric_model(
    standard_groups: List[StandardGroups],
) -> type[BaseModel]:
    """
    Create a dynamic Pydantic model based on the rubric's standard groups.

    Args:
        standard_groups: List of standard groups for this rubric

    Returns:
        Dynamic Pydantic model class
    """
    fields: dict[str, Any] = {}

    for group in standard_groups:
        # Create safe field names by removing special characters and spaces
        safe_name = create_safe_field_name(group.short_name)

        # Create field for the score (1-5)
        score_field_name = f"{safe_name}_score"
        fields[score_field_name] = (
            int,
            Field(ge=1, le=5, description=f"Score for {group.name} (1-5)"),
        )

        # Create field for the feedback
        feedback_field_name = f"{safe_name}_feedback"
        fields[feedback_field_name] = (
            str,
            Field(description=f"Feedback for {group.name}"),
        )

    # Add overall fields
    fields["overall_score"] = (int, Field(description="Overall total score"))
    fields["passed"] = (bool, Field(description="Whether the evaluation passed"))
    fields["summary"] = (str, Field(description="Overall evaluation summary"))

    return create_model("DynamicRubricGrade", **fields)  # type: ignore


async def run_grade_agent(
    simulation_chat_id: uuid.UUID, session: Session = Depends(get_session)
) -> str:
    """
    This function is used to run the grading agent for simulation chats.
    Returns a string of the simulation_chat_grade id.

    Args:
        simulation_chat_id: The ID of the simulation chat

    Returns:
        A string of the simulation_chat_grade id.
    """
    try:
        # find agent with name of "Grade"
        agent = session.exec(select(Agents).where(Agents.name == "Grade")).one()
        if not agent:
            raise ValueError("Grade agent not found")

        # get the chat from the simulation_chat_id
        chat = session.exec(
            select(SimulationChats).where(SimulationChats.id == simulation_chat_id)
        ).one()

        # get all the messages for the chat_id, order by created_at
        messages = session.exec(
            select(SimulationMessages).where(
                SimulationMessages.chat_id == simulation_chat_id
            )
        ).all()

        messages = list(messages)
        messages = sorted(messages, key=lambda x: x.created_at)

        # prepare conversation history from chat_id
        conversation_history = get_simulation_conversation_history(messages)

        # Get the simulation attempt to find the simulation
        attempt = session.exec(
            select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
        ).one()

        # Get the simulation to find the rubric
        simulation = session.exec(
            select(Simulations).where(Simulations.id == attempt.simulation_id)
        ).one()

        if not simulation.rubric_id:
            raise ValueError(
                f"Simulation {simulation.id} does not have a rubric assigned"
            )

        rubric_id = simulation.rubric_id

        # get rubric from rubric_id
        rubric = session.exec(select(Rubrics).where(Rubrics.id == rubric_id)).one()

        # get standard groups from rubric
        standard_groups = session.exec(
            select(StandardGroups).where(StandardGroups.rubric_id == rubric_id)
        ).all()

        # get standards from standard_groups
        standard_group_ids = [group.id for group in standard_groups]
        standards = session.exec(
            select(Standards).where(Standards.standard_group_id.in_(standard_group_ids))
        ).all()

        logger.info(
            f"Starting grading for simulation chat {simulation_chat_id} with rubric {rubric.name}"
        )
        logger.info(
            f"Found {len(standard_groups)} standard groups and {len(standards)} standards"
        )

        # Build dynamic rubric using utility function
        rubric_input = get_dynamic_rubric(
            rubric, list(standard_groups), list(standards)
        )

        # Create dynamic Pydantic model for the rubric
        DynamicRubric = create_dynamic_rubric_model(list(standard_groups))

        # Log the expected field names for debugging
        expected_fields = []
        for group in standard_groups:
            safe_name = create_safe_field_name(group.short_name)
            expected_fields.extend([f"{safe_name}_score", f"{safe_name}_feedback"])
        logger.info(f"Expected model fields: {expected_fields}")

        # getting the model from the agent's model_id
        model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
        if not model:
            raise ValueError(f"Model with ID {agent.model_id} not found")

        # getting the provider from the model's provider_id
        provider = session.exec(
            select(Providers).where(Providers.id == model.provider_id)
        ).one()
        if not provider:
            raise ValueError(f"Provider with ID {model.provider_id} not found")

        grading_agent = GenericAgent(
            agent_name=agent.name,
            system_prompt=agent.system_prompt,
            temperature=agent.temperature,
            model_name=model.name,
            model_provider=provider.name,
            api_key=provider.api_key,
            reasoning=agent.reasoning,
            output_type=DynamicRubric,
        )

        agent_instance = grading_agent.agent()

        # Prepare input with rubric and conversation history
        input_items = [rubric_input] + conversation_history

        # Run the grading
        logger.info("Running grading agent...")
        with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
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

        # Extract overall grading data
        overall_score = getattr(grading_result, "overall_score", 0)
        passed = getattr(grading_result, "passed", False)

        logger.info(f"Grading results: score={overall_score}, passed={passed}")

        # Create the simulation chat grade record
        simulation_chat_grade = SimulationChatGrades(
            passed=passed,
            score=overall_score,
            time_taken=time_taken,
            rubric_id=rubric_id,
            simulation_chat_id=simulation_chat_id,
        )

        session.add(simulation_chat_grade)
        session.flush()  # Get the ID without committing

        # Create feedback records for each standard group
        feedback_count = 0
        for group in standard_groups:
            # Create safe field names (same logic as in model creation)
            safe_name = create_safe_field_name(group.short_name)

            # Get the score and feedback for this group
            score_field = f"{safe_name}_score"
            feedback_field = f"{safe_name}_feedback"

            try:
                group_score = getattr(grading_result, score_field, 0)
                group_feedback = getattr(grading_result, feedback_field, "")

                logger.info(
                    f"Group {group.short_name}: score={group_score}, feedback_length={len(group_feedback)}"
                )

                # Find the corresponding standard for this score
                group_standards = [
                    s for s in standards if s.standard_group_id == group.id
                ]
                matching_standard = None
                for standard in group_standards:
                    if standard.points == group_score:
                        matching_standard = standard
                        break

                if matching_standard:
                    # Create feedback record
                    simulation_chat_feedback = SimulationChatFeedbacks(
                        standard_id=matching_standard.id,
                        simulation_chat_grade_id=simulation_chat_grade.id,
                        total=group_score,
                        feedback=group_feedback,
                    )
                    session.add(simulation_chat_feedback)
                    feedback_count += 1
                else:
                    logger.warning(
                        f"No matching standard found for group {group.short_name} with score {group_score}"
                    )

            except AttributeError as e:
                logger.error(
                    f"Failed to get grading data for group {group.short_name}: {e}"
                )
                continue

        logger.info(f"Created {feedback_count} feedback records")

        # Mark chat as completed
        chat.completed = True
        chat.completed_at = current_time
        session.add(chat)

        # Commit all changes
        session.commit()
        session.refresh(simulation_chat_grade)

        logger.info(
            f"Grading completed successfully with grade ID: {simulation_chat_grade.id}"
        )
        return str(simulation_chat_grade.id)

    except Exception as e:
        logger.error(f"Error in run_grade_agent: {str(e)}", exc_info=True)
        session.rollback()
        raise

import logging
import uuid
from collections.abc import Sequence

from agents.items import TResponseInputItem
from app.db import get_session
from app.models import (Documents, Fields, Messages, Parameters, Personas,
                        Rubrics, Scenarios, Standards)
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_preamble(scenario: Scenarios) -> TResponseInputItem:
    """
    Create a user message with the scenario's title, problem statement, and objectives.
    """
    title = scenario.title
    problem_statement = scenario.problem_statement or "No problem statement provided"
    objectives = scenario.objectives or []

    # Format objectives as a bulleted list
    objectives_text = ""
    if objectives:
        objectives_text = "\nObjectives:\n" + "\n".join(
            f"• {obj}" for obj in objectives
        )

    content = f"{title}\n\nProblem Statement: {problem_statement}{objectives_text}\n\nThe following is the current history of the conversation. Continue the conversation from this point on:"
    return {"role": "user", "content": content}


def pick_latest_message(messages: Sequence[Messages]) -> Messages | None:
    """
    Pick the latest message by created_at timestamp, with id as tiebreaker.
    
    Args:
        messages: List of Messages objects from the database
        
    Returns:
        The latest message or None if no messages
    """
    if not messages:
        return None
    
    latest: Messages | None = None
    latest_ts = 0.0
    
    for message in messages:
        ts = message.created_at.timestamp() if message.created_at else 0.0
        if latest is None or ts > latest_ts or (ts == latest_ts and str(message.id) > str(latest.id)):
            latest = message
            latest_ts = ts
    
    return latest


def build_ancestry(messages: Sequence[Messages], tip_id: str | None = None, max_hops: int = 4096) -> list[Messages]:
    """
    Build linear ancestry from a tip by following parent_id until null.
    - Ignores messages not on this chain (by design).
    - Stops on missing parent or cycle.
    - Returns array ordered root -> tip.
    
    Args:
        messages: List of Messages objects from the database
        tip_id: ID of the tip message to start from (if None, uses latest message)
        max_hops: Maximum number of hops to prevent infinite loops
        
    Returns:
        List of messages ordered from root to tip
    """
    if not messages:
        return []
    
    # Create a map for quick lookup
    by_id: dict[str, Messages] = {str(msg.id): msg for msg in messages}
    
    # Find the tip message
    tip = by_id.get(tip_id) if tip_id else pick_latest_message(messages)
    if not tip:
        return []
    
    path = []
    seen = set()
    
    # Climb: tip -> ... -> root
    current: Messages | None = tip
    hops = 0
    while current and hops < max_hops:
        if current.id in seen:
            break  # cycle guard
        seen.add(current.id)
        path.append(current)
        
        # Get parent_id (assuming Messages has parent_id attribute)
        parent_id = getattr(current, 'parent_id', None)
        if not parent_id:
            break  # reached root
        current = by_id.get(str(parent_id))
        if not current:
            break  # missing parent? stop
        hops += 1
    
    # Return root -> tip
    return path[::-1]


def get_conversation_history(messages: Sequence[Messages]) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages using DAG approach.

    Args:
        messages: List of Messages objects from the database

    Returns:
        List of message objects formatted for OpenAI API consumption
    """
    conversation_history: list[TResponseInputItem] = []

    # Build ancestry from latest message
    ancestry = build_ancestry(messages)
    
    for message in ancestry:
        if message.role == "user" and message.content:
            user_message_item: TResponseInputItem = {
                "role": "user",
                "content": f"[HUMAN TRAINEE]: {message.content}",
            }
            conversation_history.append(user_message_item)
        elif message.role == "assistant" and message.content:
            assistant_message_item: TResponseInputItem = {
                "role": "assistant",
                "content": f"[AI TRAINING PARTNER]: {message.content}",
            }
            conversation_history.append(assistant_message_item)

    logger.info(
        f"Generated conversation history with {len(conversation_history)} messages using DAG approach"
    )

    return conversation_history


def get_formatted_conversation_history_with_personas(
    messages: Sequence[Messages],
    session: Session,
    last_user_id: str | None = None,
) -> str:
    """
    Get the conversation history formatted with persona names instead of roles using DAG approach.

    Args:
        messages: List of Messages objects from the database
        session: Database session for persona lookups
        last_user_id: Optional ID of the last user message to start backtracking from

    Returns:
        Formatted conversation string like "Ashok:\nHi, how are you?\nSarah:\nI'm well, what about you."
    """
    if not messages:
        return ""

    # Build ancestry from latest message or specified last_user_id using DAG approach
    ancestry = build_ancestry(messages, tip_id=last_user_id)
    
    conversation_lines = []

    for message in ancestry:
        if not message.content or not message.content.strip():
            continue

        # Get persona name from persona_id
        persona_name = "Unknown"
        if message.persona_id:
            try:
                persona = session.exec(
                    select(Personas).where(Personas.id == message.persona_id)
                ).one_or_none()
                if persona and persona.name:
                    persona_name = persona.name
            except Exception as e:
                logger.warning(f"Failed to lookup persona {message.persona_id}: {e}")

        # Format: "PersonaName:\nMessage content"
        conversation_lines.append(f"{persona_name}:\n{message.content.strip()}")

    formatted_history = "\n".join(conversation_lines)
    logger.info(
        f"Generated formatted conversation history with {len(conversation_lines)} messages using DAG approach"
    )

    return formatted_history


def get_dynamic_rubric(
    rubric: Rubrics,
    standards: list[Standards],
) -> TResponseInputItem:
    """
    Build a dynamic rubric from database objects.

    Args:
        rubric: The rubric object from database
        standards: List of standards for this rubric

    Returns:
        Dynamic rubric formatted for agent consumption
    """
    rubric_lines = [
        f"RUBRIC: {rubric.name}",
        f"Description: {rubric.description}",
        f"Total Points: {rubric.total_points}",
        "",
        "EVALUATION CRITERIA:",
        "",
    ]

    # Sort standards by name for consistent ordering
    sorted_standards = sorted(standards, key=lambda x: x.name)

    # Build criteria sections
    for standard in sorted_standards:
        rubric_lines.extend(
            [
                f"CRITERION: {standard.name}",
                f"Description: {standard.description}",
                "Rating Scale:",
            ]
        )

        # Add items if they exist
        if standard.items:
            for item in standard.items:
                rubric_lines.append(f"  - {item}")
        else:
            # Default 1-5 scale if no specific items
            rubric_lines.extend(
                [
                    "  5 - Excellent: Outstanding performance",
                    "  4 - Good: Above average performance",
                    "  3 - Average: Adequate performance",
                    "  2 - Below Average: Needs improvement",
                    "  1 - Poor: Unsatisfactory performance",
                ]
            )

        rubric_lines.append("")  # Empty line between criteria

    rubric_string = "\n".join(rubric_lines)

    return {
        "role": "developer",
        "content": f"You are evaluating a conversation based on the following rubric. Please provide scores (1-5) and feedback for each criterion.\n\n{rubric_string}",
    }


def get_parameter_history_from_field_values(
    field_values: list[dict],
    session: Session,
    parent_scenario_id: uuid.UUID | None = None,
    persona_ids: list[uuid.UUID] | None = None,
    persona_aliases: dict[uuid.UUID, str] | None = None,
) -> list[TResponseInputItem]:
    """
    Get parameter history directly from field_values with improved structure.
    Creates two developer messages:
    1. Persona information with aliases, names, descriptions, levels, and positions
    2. Additional information including scenario details and non-persona field values

    Args:
        field_values: List of field value dictionaries with fieldId, value, parameterId, personaAlias
        session: Database session for lookups
        parent_scenario_id: Optional parent scenario ID to include context
        persona_ids: Optional list of persona IDs to get persona information directly

    Returns:
        List of parameter messages formatted for agent consumption
    """
    messages: list[TResponseInputItem] = []

    if not field_values:
        return messages

    # Use a fresh session for this operation to avoid prepared statement conflicts
    fresh_session = next(get_session())
    try:
        # Build persona information message using persona_ids and persona_aliases
        if persona_ids and persona_aliases:
            persona_info_lines = []

            from app.models import Personas

            for persona_id in persona_ids:
                persona_alias = persona_aliases.get(persona_id)
                if not persona_alias:
                    continue

                persona = fresh_session.exec(
                    select(Personas).where(Personas.id == persona_id)
                ).one_or_none()
                if not persona:
                    continue

                persona_info = f"**Alias:** {persona_alias}\n**Name:** {persona.name}"

                # Add description from persona record
                if persona.description:
                    persona_info += f"\n**Description:** {persona.description}"

                # Add position from persona record
                if persona.position:
                    persona_info += f"\n**Position:** {persona.position}"

                # Add level from persona record
                if persona.level:
                    level_display = (
                        persona.level.title()
                    )  # Convert 'junior' to 'Junior', etc.
                    if persona.level == "junior":
                        level_display = (
                            "Junior: New employee or individual contributor (0-3 years)"
                        )
                    elif persona.level == "mid":
                        level_display = "Mid-Level: Experienced team member or specialist (3-7 years)"
                    elif persona.level == "senior":
                        level_display = (
                            "Senior: Senior professional or team lead (7+ years)"
                        )
                    elif persona.level == "executive":
                        level_display = "Executive: Director, VP, or C-level executive"
                    persona_info += f"\n**Level:** {level_display}"

                persona_info_lines.append(persona_info)

            if persona_info_lines:
                persona_content = "\n\n".join(persona_info_lines)
                messages.append(
                    {
                        "role": "developer",
                        "content": f"### Available Personas\n\n{persona_content}",
                    }
                )

        # Build additional information message
        additional_info_lines = []

        # Add scenario information if provided
        if parent_scenario_id:
            parent_scenario = session.exec(
                select(Scenarios).where(Scenarios.id == parent_scenario_id)
            ).one_or_none()
            if parent_scenario:
                # Build persona context string with actual user names
                persona_context = ""
                if persona_ids and persona_aliases:
                    user_names = []
                    for persona_id in persona_ids:
                        persona_alias = persona_aliases.get(persona_id)
                        if persona_alias:
                            # Get the actual persona name from the database
                            persona = fresh_session.exec(
                                select(Personas).where(Personas.id == persona_id)
                            ).one_or_none()
                            if (
                                persona and persona.profile_id is not None
                            ):  # Only include users (not agents)
                                user_names.append(persona.name)

                    if user_names:
                        if len(user_names) == 1:
                            persona_context = f" (for {user_names[0]})"
                        elif len(user_names) > 1:
                            persona_context = f" (for users: {', '.join(user_names)})"

                scenario_info = (
                    f"**Scenario{persona_context}:** {parent_scenario.title}"
                )
                if parent_scenario.description:
                    scenario_info += f"\n**Description:** {parent_scenario.description}"
                additional_info_lines.append(scenario_info)

        # Add field values - check if they're mapped to personas or are general context
        for fv in field_values:
            field_id = fv.get("fieldId")
            if not field_id:
                continue

            field = fresh_session.exec(
                select(Fields).where(Fields.id == field_id)
            ).one_or_none()
            if not field:
                continue

            # Check if this field is mapped to a persona (from frontend personaId)
            persona_id_str = fv.get("personaId")
            if persona_id_str:
                # This field is mapped to a specific persona - find the persona name
                persona_name = "Unknown Persona"
                try:
                    persona_id = uuid.UUID(persona_id_str)
                    from app.models import Personas

                    persona = fresh_session.exec(
                        select(Personas).where(Personas.id == persona_id)
                    ).one_or_none()
                    if persona:
                        persona_name = persona.name
                except (ValueError, TypeError):
                    # Invalid UUID format
                    pass

                field_info = (
                    f"**{field.name or field.field_type} (for {persona_name}):**"
                )
            else:
                # This is general conversation context
                field_info = f"**{field.name or field.field_type}:**"

            # Process the field value
            value = fv.get("value", "").strip()
            parameter_id = fv.get("parameterId")

            if not value and not parameter_id:
                continue

            # Handle different field types
            if field.field_type == "document":
                doc_id = value
                if not doc_id and parameter_id:
                    from app.models import Parameters as _Parameters

                    param_row = fresh_session.exec(
                        select(_Parameters).where(_Parameters.id == parameter_id)
                    ).one_or_none()
                    if param_row and param_row.value:
                        doc_id = param_row.value
                if doc_id:
                    document = fresh_session.exec(
                        select(Documents).where(Documents.id == doc_id)
                    ).one_or_none()
                    if document:
                        doc_content = (
                            document.content
                            if document.content
                            else "No content available"
                        )
                        field_info += f" document `{str(doc_id)[:8]}`\n{doc_content}"
                    else:
                        field_info += f" {doc_id}"

            elif field.field_type == "categorical" and parameter_id:
                param = fresh_session.exec(
                    select(Parameters).where(Parameters.id == parameter_id)
                ).one_or_none()
                if param:
                    field_info += f" {param.name}"
                    if param.description:
                        field_info += f"\n{param.description}"
                else:
                    field_info += f" {value}"

            else:
                # For text, numerical, or other fields
                field_info += f" {value}"
                if field.description:
                    field_info += f"\n{field.description}"

            additional_info_lines.append(field_info)

        # Add additional information message if we have content
        if additional_info_lines:
            additional_content = "\n\n".join(additional_info_lines)
            messages.append(
                {
                    "role": "developer",
                    "content": f"### Additional Information\n\n{additional_content}",
                }
            )

        return messages

    except Exception as e:
        logger.error(f"Error building parameter history from field values: {e}")
        return messages
    finally:
        fresh_session.close()

import logging
import uuid
from typing import Any, Dict, List, Optional

from agents import (Runner, ToolsToFinalOutputResult, TResponseInputItem,
                    function_tool, trace)
from app.db import get_session
from app.extensions import load_prompt
from app.models import Chats, Hints, Messages, Personas, Scenarios
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_conversation_history
from pydantic import Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global storage for hint results
hint_results: Dict[str, Any] = {}
hint_progress: Dict[str, bool] = {}


def create_hint_dif_low_function() -> Any:
    """Create a function tool for generating low difficulty hints."""
    
    async def hints_dif_low(
        hints: List[str] = Field(description="List of low difficulty hints using 'Say: \"[exact quote]\"' format for direct speech")
    ) -> str:
        """Generate low difficulty hints for the user.
        
        These hints should use the exact format: Say: "[exact quote]" where the quote
        is a complete sentence the manager can speak immediately in their conversation.
        
        Args:
            hints: List of hints in "Say: '[quote]'" format that can be spoken directly
            
        Returns:
            Confirmation message
        """
        hint_results['dif_low'] = hints
        hint_progress['dif_low'] = True
        logger.info(f"✓ Generated {len(hints)} low difficulty hints")
        return f"Generated {len(hints)} low difficulty hints"
    
    return function_tool(hints_dif_low)


def create_hint_dif_high_function() -> Any:
    """Create a function tool for generating high difficulty hints."""
    
    async def hints_dif_high(
        hints: List[str] = Field(description="List of high difficulty hints that provide specific, actionable guidance for complex situations")
    ) -> str:
        """Generate high difficulty hints for the user.
        
        These hints should be specific guidance that addresses particular issues, concerns,
        or dynamics mentioned in the conversation, telling the manager exactly what to focus on.
        
        Args:
            hints: List of specific guidance that addresses concrete issues or concerns raised
            
        Returns:
            Confirmation message
        """
        hint_results['dif_high'] = hints
        hint_progress['dif_high'] = True
        logger.info(f"✓ Generated {len(hints)} high difficulty hints")
        return f"Generated {len(hints)} high difficulty hints"
    
    return function_tool(hints_dif_high)


def create_hint_tools() -> List[Any]:
    """Create all hint function tools."""
    tools = []
    
    # Add low and high difficulty hint tools
    tools.append(create_hint_dif_low_function())
    tools.append(create_hint_dif_high_function())
    
    return tools


async def get_hint_prompt() -> str:
    """Read the hint prompt from the markdown file."""
    return await load_prompt("hint")




async def run_hint_agent(
    message_id: uuid.UUID,
    session: Optional[Session] = None,
) -> dict[str, Any]:
    """
    This function is used to run the hint agent.
    Returns a dictionary with hint analysis.

    Args:
        message_id: The ID of the message
        session: Database session

    Returns:
        A dictionary containing hint analysis and metadata.
    """

    # Get a session if none is provided
    created = False
    if session is None:
        session = next(get_session())
        created = True
    
    # Type assertion to help linter understand session is not None
    assert session is not None

    try:
        # Clear previous results
        global hint_results, hint_progress
        hint_results.clear()
        hint_progress.clear()

        # Get the message object
        message = session.exec(select(Messages).where(Messages.id == message_id)).first()
        if not message:
            return {
                "success": False,
                "message": f"Message not found with ID {message_id}",
                "hint_id": None,
            }
        
        # Get the chat object to access training information
        chat = session.exec(select(Chats).where(Chats.id == message.chat_id)).first()
        if not chat:
            return {
                "success": False,
                "message": f"Chat not found for message {message_id}",
                "hint_id": None,
            }

        # Get scenario information if available
        scenario = None
        if chat.scenario_id:
            scenario = session.exec(select(Scenarios).where(Scenarios.id == chat.scenario_id)).first()

        # Get persona information
        personas: List[Personas] = []
        user_persona: Optional[Personas] = None
        assistant_personas: List[Personas] = []
        
        if chat.persona_ids:
            # Get personas individually to avoid SQLModel issues with array queries
            for persona_id in chat.persona_ids:
                persona = session.exec(select(Personas).where(Personas.id == persona_id)).one_or_none()
                if persona:
                    personas.append(persona)
                    # Identify user persona (has profile_id) and assistant personas (no profile_id)
                    if persona.profile_id is not None:
                        user_persona = persona
                    else:
                        assistant_personas.append(persona)

        # Build context information for hint generation
        context_parts = []
        
        # Add scenario information
        if scenario:
            context_parts.append(f"SCENARIO: {scenario.title}")
            if scenario.problem_statement:
                context_parts.append(f"PROBLEM STATEMENT: {scenario.problem_statement}")
            if scenario.objectives:
                context_parts.append(f"OBJECTIVES: {', '.join(scenario.objectives)}")
        
        # Add persona information
        if user_persona:
            context_parts.append(f"USER PERSONA: {user_persona.name} (the person practicing)")
            if user_persona.description:
                context_parts.append(f"USER DESCRIPTION: {user_persona.description}")
        
        if assistant_personas:
            assistant_names = [p.name for p in assistant_personas]
            context_parts.append(f"ASSISTANT PERSONAS: {', '.join(assistant_names)} (the people the user is practicing with)")
            for assistant in assistant_personas:
                if assistant.description:
                    context_parts.append(f"{assistant.name} DESCRIPTION: {assistant.description}")

        context_info = "\n".join(context_parts) if context_parts else "No additional context available."

        # Create context message first
        context_message: TResponseInputItem = {
            "role": "developer",
            "content": f"CONTEXT FOR HINT GENERATION:\n{context_info}"
        }

        # Get all messages from the chat
        all_messages = session.exec(
            select(Messages).where(Messages.chat_id == message.chat_id)
        ).all()
        
        conversation_history = get_conversation_history(all_messages)

        # Create task message at the end
        task_message: TResponseInputItem = {
            "role": "developer",
            "content": "TASK: Look back at the previous conversation and provide hints for the next message. Generate both low difficulty hints (easy to understand what to do next) and high difficulty hints (specific guidance for complex situations)."
        }

        full_conversation_history = [context_message, *conversation_history, task_message]

        # Get the hint prompt from the markdown file
        system_prompt = await get_hint_prompt()
        
        # Create hint tools
        hint_tools = create_hint_tools()
        
        # Create tool use behavior to wait for both tools to be called
        def tool_use_behavior(context: Any, tool_results: list[Any]) -> ToolsToFinalOutputResult:
            # Build list of required tools
            required_tools = ['dif_low', 'dif_high']
            
            # Check if all required tools have been called
            completed_required = all(hint_progress.get(tool, False) for tool in required_tools)
            logger.info(f"Tool use behavior check: required_tools={required_tools}, completed_required={completed_required}, hint_progress={hint_progress}")
            return ToolsToFinalOutputResult(is_final_output=completed_required)
        
        hint_agent = GenericAgent(
            agent_name="Hint Generator",
            system_prompt=system_prompt,
            temperature=0.0,
            tools=hint_tools,
            parallel_tool_calls=True,
            tool_use_behavior=tool_use_behavior,
            model="gpt-4o-mini",
        )

        with trace("Hint"):
            result = await Runner.run(
                hint_agent.agent(), 
                input=full_conversation_history
            )

        logger.info(
            f"Successfully generated hints for message {message_id}"
        )
        
        # Check if all required tools were called
        required_tools = ['dif_low', 'dif_high']
        completed_tools = [tool for tool in required_tools if hint_progress.get(tool, False)]
        logger.info(f"Hint generation completed: {len(completed_tools)}/{len(required_tools)} required tools called")
        logger.info(f"Required tools: {required_tools}")
        logger.info(f"Completed tools: {completed_tools}")
        
        if len(completed_tools) < len(required_tools):
            missing_tools = [tool for tool in required_tools if not hint_progress.get(tool, False)]
            logger.warning(f"Missing tool calls for: {missing_tools}")
        
        # Extract results from the global storage
        hint_result = hint_results
        
        # Get both types of hints (now as lists)
        dif_low_hints = hint_result.get('dif_low', [])
        dif_high_hints = hint_result.get('dif_high', [])
        
        # Create separate Hint records for each difficulty level
        hint_ids = []
        saved_hints = []
        
        if dif_low_hints:
            low_hint = Hints(
                message_id=message_id,
                contents=dif_low_hints,
                difficulty='low'
            )
            session.add(low_hint)
            hint_ids.append(str(low_hint.id))
            saved_hints.append({
                "id": str(low_hint.id),
                "difficulty": "low",
                "content": dif_low_hints
            })
            logger.info(f"Created low difficulty hint with ID: {low_hint.id} and {len(dif_low_hints)} hint items")
        
        if dif_high_hints:
            high_hint = Hints(
                message_id=message_id,
                contents=dif_high_hints,
                difficulty='high'
            )
            session.add(high_hint)
            hint_ids.append(str(high_hint.id))
            saved_hints.append({
                "id": str(high_hint.id),
                "difficulty": "high",
                "content": dif_high_hints
            })
            logger.info(f"Created high difficulty hint with ID: {high_hint.id} and {len(dif_high_hints)} hint items")
        
        session.commit()

        logger.info(
            f"Successfully saved {len(saved_hints)} hint(s) to database"
        )

        return {
            "success": True,
            "message": f"Successfully generated and saved {len(saved_hints)} hint(s)",
            "hint_ids": hint_ids,
            "message_id": str(message_id),
            "chat_id": str(message.chat_id),
            "hints": saved_hints,
            "dif_low_hints": dif_low_hints,
            "dif_high_hints": dif_high_hints
        }

    except Exception as e:
        logger.error(f"Error during hint generation: {str(e)}")
        try: session.rollback()
        except Exception: pass
        return {
            "success": False,
            "message": f"Hint generation failed: {str(e)}",
            "hint_id": None,
            "message_id": str(message_id),
        }
    finally:
        if created:
            try: session.close()
            except Exception: pass

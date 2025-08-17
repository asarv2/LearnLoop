# server/app/services/agents/voice/realtime.py
import logging
import uuid
from typing import Optional

from agents.realtime import RealtimeAgent, RealtimeRunner
from agents.realtime.config import (RealtimeInputAudioTranscriptionConfig,
                                    RealtimeRunConfig,
                                    RealtimeSessionModelSettings,
                                    RealtimeTurnDetectionConfig)
from agents.realtime.session import RealtimeSession
from app.models import Chats, Messages, Personas
from app.utils.chat import (get_conversation_history, get_parameter_history,
                            get_preamble, get_text_formatted_instructions)
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

async def create_realtime_voice_session(
    chat_id: uuid.UUID,
    persona_id: uuid.UUID,
    db_session: Session,
    *,
    model_name: str = "gpt-4o-mini-realtime-preview",
    default_voice: str = "alloy",
) -> RealtimeSession:
    """
    Create and start a RealtimeSession configured for a given persona.

    Returns an active session. The caller is responsible for closing it.
    """
    chat: Optional[Chats] = db_session.exec(
        select(Chats).where(Chats.id == chat_id)
    ).one_or_none()

    if not chat:
        logger.error(f"Chat lookup failed for ID: {chat_id}")
        raise ValueError(f"Chat with ID {chat_id} not found")

    persona: Optional[Personas] = db_session.exec(
        select(Personas).where(Personas.id == persona_id)
    ).one_or_none()

    if not persona:
        logger.error(f"Persona lookup failed for ID: {persona_id}")
        raise ValueError(f"Persona with ID {persona_id} not found")

    logger.info(f"Found persona: Name='{persona.name}', Voice='{persona.voice}'")

    if not persona.system_prompt:
        logger.error(f"Persona '{persona.name}' has no system prompt.")
        raise ValueError(f"Persona with ID {persona_id} has no system prompt")

    # get all messages for the chat
    messages = db_session.exec(select(Messages).where(Messages.chat_id == chat_id)).all()
    preamble = get_preamble(chat)
    parameter_history = get_parameter_history(chat, db_session)
    conversation_history = get_conversation_history(messages)

    instructions = [preamble] + parameter_history + conversation_history

    realtime_instructions = get_text_formatted_instructions(instructions)

        
    agent_instance = RealtimeVoiceAgent(
        name=persona.name,
        instructions=realtime_instructions,
    )

    voice = persona.voice or default_voice
    
    run_config = RealtimeRunConfig(
        model_settings=RealtimeSessionModelSettings(
            model_name=model_name,
            voice=voice,
            modalities=["text", "audio"],
            input_audio_format="pcm16",
            output_audio_format="pcm16",
            input_audio_transcription=RealtimeInputAudioTranscriptionConfig(
                model="whisper-1",
            )
        )
    )

    runner = RealtimeRunner(
        starting_agent=agent_instance.agent(),
        config=run_config,
    )

    try:
        session = await runner.run()
        await session.enter()
        return session
    except Exception as e:
        logger.error(f"Failed to create or start RealtimeSession: {e}", exc_info=True)
        raise

class RealtimeVoiceAgent:
    def __init__(
        self,
        name: str,
        instructions: str,
    ):
        self.name = name
        self.instructions = instructions

    def agent(self) -> RealtimeAgent:
        return RealtimeAgent(
            name=self.name,
            instructions=self.instructions,
        )

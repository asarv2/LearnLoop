import logging
import uuid
from typing import Optional

from agents.realtime import RealtimeAgent, RealtimeRunner
from agents.realtime.config import (RealtimeInputAudioTranscriptionConfig,
                                    RealtimeRunConfig,
                                    RealtimeSessionModelSettings,
                                    RealtimeTurnDetectionConfig)
from agents.realtime.session import RealtimeSession
from app.models import Personas
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

async def create_realtime_voice_session(
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
    persona: Optional[Personas] = db_session.exec(
        select(Personas).where(Personas.id == persona_id)
    ).one_or_none()

    if not persona:
        # ✅ Added logging
        logger.error(f"[DEBUG] Persona lookup FAILED for ID: {persona_id}")
        raise ValueError(f"Persona with ID {persona_id} not found")

    # ✅ Added logging
    logger.info(f"[DEBUG] Found Persona: Name='{persona.name}', Voice='{persona.voice}'")

    if not persona.system_prompt:
        # ✅ Added logging
        logger.error(f"[DEBUG] Persona '{persona.name}' has no system prompt.")
        raise ValueError(f"Persona with ID {persona_id} has no system prompt")

    agent_instance = RealtimeVoiceAgent(
        name=persona.name,
        instructions=persona.system_prompt,
    )

    voice = persona.voice or default_voice
    
    # ✅ Log the configuration object
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
    logger.info(f"[DEBUG] Creating RealtimeRunner with config: {run_config}")

    runner = RealtimeRunner(
        starting_agent=agent_instance.agent(),
        config=run_config, # Use the object we just logged
    )

    try:
        logger.info("[DEBUG] Attempting to start session with runner.run()")
        session = await runner.run()
        logger.info("[DEBUG] runner.run() successful. Session object created.")

        logger.info("[DEBUG] Attempting to connect session with session.enter()")
        await session.enter()
        logger.info("[DEBUG] session.enter() successful. Session is connected and active.")
        
        return session
    except Exception as e:
        logger.error(f"[DEBUG] FAILED to create or start RealtimeSession: {e}", exc_info=True)
        raise # Re-raise the exception after logging

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

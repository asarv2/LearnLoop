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
        raise ValueError(f"Persona with ID {persona_id} not found")
    if not persona.system_prompt:
        raise ValueError(f"Persona with ID {persona_id} has no system prompt")

    agent_instance = RealtimeVoiceAgent(
        name=persona.name,
        instructions=persona.system_prompt,
    )

    voice = persona.voice or default_voice

    runner = RealtimeRunner(
        starting_agent=agent_instance.agent(),
        config=RealtimeRunConfig(
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
        ),
    )

    session = await runner.run()
    # Start the model connection immediately so callers can use it
    await session.enter()
    return session

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

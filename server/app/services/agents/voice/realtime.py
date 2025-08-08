import uuid
from typing import AsyncGenerator, Tuple, Union

from agents.realtime import RealtimeAgent, RealtimeRunner
from agents.realtime.config import (RealtimeInputAudioTranscriptionConfig,
                                    RealtimeRunConfig,
                                    RealtimeSessionModelSettings,
                                    RealtimeTurnDetectionConfig)
from agents.realtime.items import RealtimeItem
from app.db import get_session
from app.models import Personas
from fastapi import Depends
from sqlmodel import Session, select


async def run_realtime_agent(
    persona_id: uuid.UUID,
    input_items: list[RealtimeItem],
    session: Session = Depends(get_session),
) -> AsyncGenerator[Union[str, Tuple[str, Union[str, bytes]]], None]:
    """
    This function is used to run the realtime voice agent using the OpenAI Agents SDK.

    Args:
        persona_id: The ID of the persona
        input_items: List of input items to send to the agent
        session: Database session
    Yields:
        Either text chunks as strings or tuples with type and data:
        - ("audio", bytes): Audio data for playback
        - ("text", str): Text transcript for display
    """
    persona = session.exec(select(Personas).where(Personas.id == persona_id)).one()
    if not persona:
        raise ValueError(f"Persona with ID {persona_id} not found")
    
    if not persona.system_prompt:
        raise ValueError(f"Persona with ID {persona_id} has no system prompt")

    # Create the realtime agent
    agent_instance = RealtimeVoiceAgent(
        name=persona.name,
        instructions=persona.system_prompt,
    )

    voice = persona.voice or "alloy"

    # Set up the runner with configuration
    runner = RealtimeRunner(
        starting_agent=agent_instance.agent(),
        config=RealtimeRunConfig(
            model_settings=RealtimeSessionModelSettings(
                model_name="gpt-4o-mini",
                voice=voice,
                modalities=["text", "audio"],
                input_audio_transcription=RealtimeInputAudioTranscriptionConfig(
                    model="whisper-1",
                ),
                turn_detection=RealtimeTurnDetectionConfig(
                    type="server_vad",
                    threshold=0.5,
                    prefix_padding_ms=300,
                    silence_duration_ms=200
                )
            )
        ),
    )

    # Start the session
    realtime_session = await runner.run()
    realtime_session._history = input_items

    async with realtime_session:
        # For realtime voice agents, we don't send initial messages
        # The agent will handle voice input directly
        
        # Process events and yield text chunks
        async for event in realtime_session:
            if event.type == "audio":
                yield ("audio", event.audio.data) # we yield the audio data so that it can be played back by the client
            elif event.type == "response.audio_transcript.done":
                yield ("text", event.transcript) # we also yield the transcript so that it can be displayed to the user
            elif event.type == "conversation.item.input_audio_transcription.completed":
                # Optionally yield user transcriptions if needed
                pass
            elif event.type == "raw_model_event":
                # Handle raw model events if needed
                pass
            elif event.type == "error":
                raise Exception(f"Realtime agent error: {event.error}")
                break


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

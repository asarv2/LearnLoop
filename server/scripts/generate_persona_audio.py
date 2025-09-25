#!/usr/bin/env python3
"""
Generate audio files for all personas using OpenAI TTS API.

This script will:
1. Load persona data from the database
2. Generate system prompts and typical quotes for each persona
3. Call OpenAI TTS API to generate audio
4. Save audio files to recordings/persona_id.wav
"""

import asyncio
import os
from dataclasses import dataclass
from pathlib import Path

import aiofiles  # type: ignore
import aiohttp

# Database imports removed - using hardcoded psersona data instead


@dataclass
class PersonaAudioData:
    """Data structure for persona audio generation"""

    id: str
    name: str
    voice: str
    system_prompt: str
    typical_quote: str
    group_name: str
    scenario: str
    description: str = ""


class PersonaAudioGenerator:
    """Generate audio files for personas using OpenAI TTS API"""

    def __init__(self, openai_api_key: str | None = None):
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError(
                "OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass it as parameter."
            )

        self.recordings_dir = Path("recordings")
        self.recordings_dir.mkdir(exist_ok=True)

        # Voice mapping from our personas to OpenAI TTS voices
        # Only valid voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse
        self.voice_mapping = {
            "alloy": "alloy",
            "ash": "ash",
            "ballad": "ballad",
            "coral": "coral",
            "echo": "echo",
            "sage": "sage",
            "shimmer": "shimmer",
            "verse": "verse",
        }

    def get_system_prompt(self, persona: PersonaAudioData) -> str:
        """Generate system prompt for persona based on their scenario"""
        prompts = {
            "apology": f"You are {persona.name}. You are receiving an apology and should respond authentically to your personality type.",
            "interview": f"You are {persona.name}. You are in a job interview and should respond authentically to your personality type.",
            "pitching": f"You are {persona.name}. You are evaluating a pitch and should respond authentically to your personality type.",
            "brainstorming": f"You are {persona.name}. You are in a brainstorming session and should respond authentically to your personality type.",
            "termination": f"You are {persona.name}. You are being terminated and should respond authentically to your personality type.",
            "feedback": f"You are {persona.name}. You are receiving constructive feedback and should respond authentically to your personality type.",
            "training": f"You are {persona.name}. You are participating in a training session and should respond authentically to your personality type.",
        }
        return prompts.get(persona.scenario, f"You are {persona.name}.")

    def get_typical_quote(self, persona: PersonaAudioData) -> str:
        """Generate typical quote for persona based on their scenario"""
        quotes = {
            "apology": {
                "Alex Kim": "I appreciate you acknowledging this, but what's most important is making sure this doesn't happen again.",
                "Lisa Martinez": "I'm hurt by what happened, but I need to see real change, not just words.",
                "Marcus Johnson": "I understand mistakes happen, but I expect accountability and a clear path forward.",
                "Sarah Chen": "Thank you for acknowledging how this affected me, that means a lot.",
            },
            "interview": {
                "Chloe Sanders": "I've found that my established approach has consistently delivered results - can you tell me more about your process?",
                "Daniel Reed": "I disagree with that assessment - I think there might be some bias here.",
                "Rebecca Owens": "There has to be some mistake here - I know I'm qualified for this role!",
                "Ryan Patel": "I'd be happy to discuss my relevant experience and how it applies to this position.",
            },
            "pitching": {
                "Amanda Foster": "This sounds promising - how can we work together to make this a success for everyone?",
                "Jennifer Adams": "I'm intrigued by the potential here - what's the strategic vision for implementation?",
                "Mark Johnson": "The idea has merit, but I'm concerned about the execution challenges and timeline.",
                "Robert Williams": "Show me the numbers - what's the expected return on investment and timeline?",
            },
            "brainstorming": {
                "David Chen": "What if we completely flipped this approach and tried something totally different?",
                "Maria Rodriguez": "I love this energy! Let's build on that idea and see where it takes us!",
                "James Thompson": "Great ideas everyone - let's prioritize these and create a roadmap for implementation.",
                "Isabella Martinez": "That's a fantastic point - what if we combined that with the earlier idea about targeting?",
            },
            "termination": {
                "Emily Harris": "I... I wasn't expecting this - can you help me understand what happened?",
                "John Miller": "I... I don't understand... this is... how will I...?",
                "Michael Torres": "This is completely unfair - I demand to see the evidence and challenge this decision.",
                "Samantha Ferguson": "I want to understand exactly what went wrong so I can improve - can you give me specific examples?",
            },
            "feedback": {
                "Nicole Wright": "I really want to do well - can you help me understand how to improve?",
                "Jessica Park": "Thank you for the feedback - can you give me some specific examples of what I should do differently?",
                "Carlos Torres": "I appreciate you bringing this up - I'm committed to growing, but I want to understand the context better.",
                "Kevin Foster": "I'm ready to work on this - what specific steps would you like me to take?",
            },
            "training": {
                "Lucas": "I'd like to understand the specific requirements and processes before we begin - can you walk me through the methodology?",
                "Zoe": "This sounds exciting! I'm really looking forward to collaborating and bringing fresh ideas to the table!",
                "Tyler": "Let's establish clear objectives and timelines - what are the key deliverables and when do you need them completed?",
                "Grace": "I'm curious about the underlying data and patterns here - can you help me understand the analytical framework we'll be using?",
            },
        }
        return quotes.get(persona.scenario, {}).get(
            persona.name, f"Hello, I'm {persona.name}."
        )

    async def generate_audio(self, persona: PersonaAudioData) -> bool:
        """Generate audio file for a single persona"""
        try:
            # Skip personas with null voice (those with profile_id)
            if persona.voice is None:
                print(f"Skipping {persona.name} - no voice assigned (has profile_id)")
                return True

            # Map voice to OpenAI TTS voice
            openai_voice = self.voice_mapping.get(persona.voice, "echo")

            # Get the text to synthesize
            text_to_synthesize = self.get_typical_quote(persona)

            print(f"Generating audio for {persona.name} ({persona.group_name})...")
            print(f"  Voice: {persona.voice} -> {openai_voice}")
            print(f"  Text: {text_to_synthesize}")

            # Call OpenAI TTS API
            async with aiohttp.ClientSession() as session:
                url = "https://api.openai.com/v1/audio/speech"
                headers = {
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json",
                }
                data = {
                    "model": "gpt-4o-mini-tts",
                    "voice": openai_voice,
                    "input": text_to_synthesize,
                }

                async with session.post(url, headers=headers, json=data) as response:
                    if response.status == 200:
                        # Save audio file
                        output_path = self.recordings_dir / f"{persona.id}.wav"
                        async with aiofiles.open(output_path, "wb") as f:
                            async for chunk in response.content.iter_chunked(1024):
                                await f.write(chunk)

                        print(f"  ✅ Saved to {output_path}")
                        return True
                    else:
                        error_text = await response.text()
                        print(f"  ❌ Error {response.status}: {error_text}")
                        return False

        except Exception as e:
            print(f"  ❌ Exception: {e}")
            return False

    async def generate_all_audio(
        self, personas: list[PersonaAudioData], max_concurrent: int = 3
    ) -> list:
        """Generate audio for all personas with concurrency control"""
        semaphore = asyncio.Semaphore(max_concurrent)

        async def generate_with_semaphore(persona: PersonaAudioData) -> bool:
            async with semaphore:
                return await self.generate_audio(persona)

        tasks = [generate_with_semaphore(persona) for persona in personas]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        successful = sum(1 for result in results if result is True)
        total = len(personas)

        print(
            f"\n🎉 Generation complete: {successful}/{total} audio files generated successfully"
        )

        return results


def load_personas_from_database() -> list[PersonaAudioData]:
    """Load personas - using hardcoded data for simplicity"""
    print("Using hardcoded persona data...")
    return get_hardcoded_personas()


def get_hardcoded_personas() -> list[PersonaAudioData]:
    """Hardcoded persona data as fallback"""
    return [
        # Employee Group
        PersonaAudioData(
            "b8aa1ebe-9f76-4b61-98c9-f71fe41a67a9",
            "Lucas",
            "echo",
            "",
            "",
            "Employee",
            "training",
        ),
        PersonaAudioData(
            "dcab41a9-3747-408a-bdd9-49525ca173c7",
            "Zoe",
            "alloy",
            "",
            "",
            "Employee",
            "training",
        ),
        PersonaAudioData(
            "c8b96e5b-55cb-48a4-a671-0cd6a291617b",
            "Tyler",
            "verse",
            "",
            "",
            "Employee",
            "training",
        ),
        PersonaAudioData(
            "74019f63-8666-47a0-83cf-0c7669312912",
            "Grace",
            "shimmer",
            "",
            "",
            "Employee",
            "training",
        ),
    ]


async def main() -> None:
    """Main function"""
    print("🎙️  Persona Audio Generator")
    print("=" * 50)

    # Check for OpenAI API key
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        print("❌ Error: OPENAI_API_KEY environment variable not set")
        print("Please set your OpenAI API key:")
        print("export OPENAI_API_KEY='your-api-key-here'")
        return

    # Load personas
    print("📋 Loading personas...")
    personas = load_personas_from_database()
    print(f"Found {len(personas)} personas")

    # Create generator
    generator = PersonaAudioGenerator(openai_key)

    # Generate audio files
    print("\n🎵 Generating audio files...")
    print("This may take several minutes depending on the number of personas...")

    results = await generator.generate_all_audio(personas, max_concurrent=3)

    # Summary
    print("\n📊 Summary:")
    for i, (persona, result) in enumerate(zip(personas, results, strict=False)):
        status = "✅" if result is True else "❌"
        print(f"  {status} {persona.name} ({persona.group_name})")

    print("\n🎉 Audio generation complete!")
    print(f"Files saved to: {generator.recordings_dir.absolute()}")


if __name__ == "__main__":
    asyncio.run(main())

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
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

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
        self.openai_api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass it as parameter.")
        
        self.recordings_dir = Path("recordings")
        self.recordings_dir.mkdir(exist_ok=True)
        
        # Voice mapping from our personas to OpenAI TTS voices
        # Only valid voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse
        self.voice_mapping = {
            'alloy': 'alloy',
            'ash': 'ash',
            'ballad': 'ballad',
            'coral': 'coral',
            'echo': 'echo',
            'sage': 'sage',
            'shimmer': 'shimmer',
            'verse': 'verse'
        }
    
    def get_system_prompt(self, persona: PersonaAudioData) -> str:
        """Generate system prompt for persona based on their scenario"""
        prompts = {
            'apology': f"You are {persona.name}. You are receiving an apology and should respond authentically to your personality type.",
            'interview': f"You are {persona.name}. You are in a job interview and should respond authentically to your personality type.",
            'pitching': f"You are {persona.name}. You are evaluating a pitch and should respond authentically to your personality type.",
            'brainstorming': f"You are {persona.name}. You are in a brainstorming session and should respond authentically to your personality type.",
            'termination': f"You are {persona.name}. You are being terminated and should respond authentically to your personality type.",
            'feedback': f"You are {persona.name}. You are receiving constructive feedback and should respond authentically to your personality type."
        }
        return prompts.get(persona.scenario, f"You are {persona.name}.")
    
    def get_typical_quote(self, persona: PersonaAudioData) -> str:
        """Generate typical quote for persona based on their scenario"""
        quotes = {
            'apology': {
                'David Kim': "I appreciate you acknowledging this, but what's most important is making sure this doesn't happen again.",
                'Lisa Martinez': "I'm hurt by what happened, but I need to see real change, not just words.",
                'Marcus Johnson': "I understand mistakes happen, but I expect accountability and a clear path forward.",
                'Sarah Chen': "Thank you for acknowledging how this affected me, that means a lot."
            },
            'interview': {
                'Chloe Sanders': "I've found that my established approach has consistently delivered results - can you tell me more about your process?",
                'Daniel Reed': "I disagree with that assessment - I think there might be some bias here.",
                'Rebecca Owens': "There has to be some mistake here - I know I'm qualified for this role!",
                'Ryan Patel': "I'd be happy to discuss my relevant experience and how it applies to this position."
            },
            'pitching': {
                'Amanda Foster': "This sounds promising - how can we work together to make this a success for everyone?",
                'Jennifer Adams': "I'm intrigued by the potential here - what's the strategic vision for implementation?",
                'Mark Johnson': "The idea has merit, but I'm concerned about the execution challenges and timeline.",
                'Robert Williams': "Show me the numbers - what's the expected return on investment and timeline?"
            },
            'brainstorming': {
                'David Chen': "What if we completely flipped this approach and tried something totally different?",
                'Emily Rodriguez': "I love this energy! Let's build on that idea and see where it takes us!",
                'James Thompson': "Great ideas everyone - let's prioritize these and create a roadmap for implementation.",
                'Sarah Martinez': "That's a fantastic point - what if we combined that with the earlier idea about targeting?"
            },
            'termination': {
                'Emily Harris': "I... I wasn't expecting this - can you help me understand what happened?",
                'John Miller': "I... I don't understand... this is... how will I...?",
                'Michael Torres': "This is completely unfair - I demand to see the evidence and challenge this decision.",
                'Samantha Ferguson': "I want to understand exactly what went wrong so I can improve - can you give me specific examples?"
            },
            'feedback': {
                'Amanda Wright': "I really want to do well - can you help me understand how to improve?",
                'Jessica Park': "Thank you for the feedback - can you give me some specific examples of what I should do differently?",
                'Michael Torres': "I appreciate you bringing this up - I'm committed to growing, but I want to understand the context better.",
                'Ryan Foster': "I'm ready to work on this - what specific steps would you like me to take?"
            }
        }
        return quotes.get(persona.scenario, {}).get(persona.name, f"Hello, I'm {persona.name}.")
    
    async def generate_audio(self, persona: PersonaAudioData) -> bool:
        """Generate audio file for a single persona"""
        try:
            # Skip personas with null voice (those with profile_id)
            if persona.voice is None:
                print(f"Skipping {persona.name} - no voice assigned (has profile_id)")
                return True
            
            # Map voice to OpenAI TTS voice
            openai_voice = self.voice_mapping.get(persona.voice, 'echo')
            
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
                    "Content-Type": "application/json"
                }
                data = {
                    "model": "tts-1",
                    "voice": openai_voice,
                    "input": text_to_synthesize
                }
                
                async with session.post(url, headers=headers, json=data) as response:
                    if response.status == 200:
                        # Save audio file
                        output_path = self.recordings_dir / f"{persona.id}.wav"
                        async with aiofiles.open(output_path, 'wb') as f:
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
    
    async def generate_all_audio(self, personas: List[PersonaAudioData], max_concurrent: int = 3) -> List:
        """Generate audio for all personas with concurrency control"""
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def generate_with_semaphore(persona: PersonaAudioData) -> bool:
            async with semaphore:
                return await self.generate_audio(persona)
        
        tasks = [generate_with_semaphore(persona) for persona in personas]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = sum(1 for result in results if result is True)
        total = len(personas)
        
        print(f"\n🎉 Generation complete: {successful}/{total} audio files generated successfully")
        
        return results

def load_personas_from_database() -> List[PersonaAudioData]:
    """Load personas - using hardcoded data for simplicity"""
    print("Using hardcoded persona data...")
    return get_hardcoded_personas()

def get_hardcoded_personas() -> List[PersonaAudioData]:
    """Hardcoded persona data as fallback"""
    return [
        # Affected Employee Group
        PersonaAudioData("d6c5cdab-3d68-406d-a63a-f0b6e7a11197", "David Kim", "echo", "", "", "Affected Employee", "apology"),
        PersonaAudioData("3aa1f056-0c1a-4f04-b8c3-bd3e2e832a46", "Lisa Martinez", "shimmer", "", "", "Affected Employee", "apology"),
        PersonaAudioData("f2bef9da-b98b-4aae-bbca-70ac8743939d", "Marcus Johnson", "ash", "", "", "Affected Employee", "apology"),
        PersonaAudioData("6a497a62-1815-4e49-b107-228af0490cac", "Sarah Chen", "nova", "", "", "Affected Employee", "apology"),
        
        # Interviewee Group
        PersonaAudioData("e74ee74b-e316-4194-b080-9854ac1cccf8", "Chloe Sanders", "sage", "", "", "Interviewee", "interview"),
        PersonaAudioData("2401b795-9bda-41f1-8800-cc63a78e7528", "Daniel Reed", "verse", "", "", "Interviewee", "interview"),
        PersonaAudioData("52aed50d-137c-44b5-aba0-1702fe00a4c1", "Rebecca Owens", "shimmer", "", "", "Interviewee", "interview"),
        PersonaAudioData("945f6056-cdc8-4c56-a7af-79f66a37754f", "Ryan Patel", "echo", "", "", "Interviewee", "interview"),
        
        # Stakeholder Group
        PersonaAudioData("12dfc984-9e5e-4d7b-825a-bfed832c48c2", "Amanda Foster", "shimmer", "", "", "Stakeholder", "pitching"),
        PersonaAudioData("2095c0cb-e1d7-4f30-94c9-b32af8209f59", "Jennifer Adams", "nova", "", "", "Stakeholder", "pitching"),
        PersonaAudioData("b51c0cba-cda1-4c1e-8933-d92d6cd05688", "Mark Johnson", "echo", "", "", "Stakeholder", "pitching"),
        PersonaAudioData("0a487bb7-582b-4e7b-ad33-2b092e5c0baf", "Robert Williams", "alloy", "", "", "Stakeholder", "pitching"),
        
        # Team Member Group
        PersonaAudioData("6d1c522a-dbcc-4185-bc90-f290777d9332", "David Chen", "echo", "", "", "Team Member", "brainstorming"),
        PersonaAudioData("f87dae36-9340-43e0-98f5-187b1683b4f2", "Emily Rodriguez", "shimmer", "", "", "Team Member", "brainstorming"),
        PersonaAudioData("048a249f-7382-4233-a2c2-f19992932246", "James Thompson", "nova", "", "", "Team Member", "brainstorming"),
        PersonaAudioData("c6f72995-271e-4187-872d-22a13460b445", "Sarah Martinez", "alloy", "", "", "Team Member", "brainstorming"),
        
        # Terminated Employee Group
        PersonaAudioData("eb1d792c-6e48-4db6-8a89-e56162746273", "Emily Harris", "shimmer", "", "", "Terminated Employee", "termination"),
        PersonaAudioData("14641baf-9e57-411c-b24d-57f1b5e54178", "John Miller", "echo", "", "", "Terminated Employee", "termination"),
        PersonaAudioData("a1606414-c9b5-4058-ba30-3b11b606c412", "Michael Torres", "ash", "", "", "Terminated Employee", "termination"),
        PersonaAudioData("188cb068-1e18-40fd-8395-c2ce8a9f7465", "Samantha Ferguson", "alloy", "", "", "Terminated Employee", "termination"),
        
        # Underperforming Employee Group
        PersonaAudioData("22a93c61-261f-4c74-b9ed-43cb68bb8016", "Amanda Wright", "shimmer", "", "", "Underperforming Employee", "feedback"),
        PersonaAudioData("c312c065-bef2-4ecd-bd72-c9e9cce7e4d4", "Jessica Park", "nova", "", "", "Underperforming Employee", "feedback"),
        PersonaAudioData("60399d3c-02a6-4dc5-b23f-a987cfc61407", "Michael Torres", "alloy", "", "", "Underperforming Employee", "feedback"),
        PersonaAudioData("6fb5b778-f4f6-4d3f-8c8d-99c6929c70ff", "Ryan Foster", "echo", "", "", "Underperforming Employee", "feedback"),
    ]

async def main() -> None:
    """Main function"""
    print("🎙️  Persona Audio Generator")
    print("=" * 50)
    
    # Check for OpenAI API key
    openai_key = os.getenv('OPENAI_API_KEY')
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
    for i, (persona, result) in enumerate(zip(personas, results)):
        status = "✅" if result is True else "❌"
        print(f"  {status} {persona.name} ({persona.group_name})")
    
    print(f"\n🎉 Audio generation complete!")
    print(f"Files saved to: {generator.recordings_dir.absolute()}")

if __name__ == "__main__":
    asyncio.run(main())

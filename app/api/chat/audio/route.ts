// app/api/chat/audio/route.ts

import { realtimeConfig } from "@/utils/ai/main";
import { NextResponse } from "next/server";

export async function POST() {
    const inlinedBody = {
        model: realtimeConfig.model,
        input_audio_transcription: realtimeConfig.config?.inputAudioTranscription,
        voice: realtimeConfig.config?.voice,
        modalities: realtimeConfig.config?.modalities,
    }
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(inlinedBody)
    });
    // get ephermral key from openAI    
    const data = await response.json();
    return NextResponse.json({ data });
}
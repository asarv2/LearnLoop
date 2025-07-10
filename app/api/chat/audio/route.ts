// app/api/chat/audio/route.ts

import { getRealtimeConfig } from "@/utils/ai/main";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const { chatTitle, chatId } = await req.json();
    const realtimeConfig = await getRealtimeConfig(chatTitle, chatId);
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
    const { client_secret } = await response.json();
    const { value } = client_secret;
    return NextResponse.json({ api_key: value });
}
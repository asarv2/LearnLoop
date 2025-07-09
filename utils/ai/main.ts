import AsyncOpenAI from 'openai';
import { setDefaultOpenAIClient } from "@openai/agents";
import { GoogleGenAI } from "@google/genai";
import { RealtimeSessionOptions } from '@openai/agents/realtime';

export const openai = new AsyncOpenAI({
    apiKey: process.env["GEMINI_API_KEY"],
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});
setDefaultOpenAIClient(openai);

export const google = new GoogleGenAI({});

export const realtimeConfig: Partial<RealtimeSessionOptions> = {
    model: "gpt-4o-mini-realtime-preview",
    config: {
        modalities: ['audio', 'text'],
        inputAudioTranscription: { model: 'whisper-1' },
        voice: 'alloy',
    },
}

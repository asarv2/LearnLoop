"use server"
import AsyncOpenAI from 'openai';
import { GoogleGenAI } from "@google/genai";
import { setDefaultOpenAIClient } from "@openai/agents";
import { RealtimeSessionOptions } from '@openai/agents/realtime';

export const getOpenAIClient = async (): Promise<AsyncOpenAI> => {
    const openai = new AsyncOpenAI({
        apiKey: process.env["GEMINI_API_KEY"],
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });
    setDefaultOpenAIClient(openai);
    return openai;
}
getOpenAIClient();


export const getGoogleGenAIClient = async (): Promise<GoogleGenAI> => {
    return new GoogleGenAI({ apiKey: process.env["GEMINI_API_KEY"] });
}

export const getRealtimeConfig = async (): Promise<Partial<RealtimeSessionOptions>> => {
    return {
        model: "gpt-4o-mini-realtime-preview",
        config: {
            modalities: ['audio', 'text'],
            inputAudioTranscription: { model: 'whisper-1' },
            voice: 'alloy',
        },
    }
}


// realtimeConfig: Partial<RealtimeSessionOptions> = {
//     model: "gpt-4o-mini-realtime-preview",
//     config: {
//         modalities: ['audio', 'text'],
//         inputAudioTranscription: { model: 'whisper-1' },
//         voice: 'alloy',
//     },
// }

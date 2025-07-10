"use server"
import { GoogleGenAI } from "@google/genai";
import { OpenAIChatCompletionsModel } from '@openai/agents';
import { RealtimeSessionOptions } from '@openai/agents/realtime';
import AsyncOpenAI from 'openai';

export const getGeminiModel = async (model: string): Promise<OpenAIChatCompletionsModel> => {
    const openai = new AsyncOpenAI({
        apiKey: process.env["GOOGLE_GENERATIVE_AI_API_KEY"],
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    })
    return new OpenAIChatCompletionsModel(openai, model);
}

export const getGoogleGenAIClient = async (): Promise<GoogleGenAI> => {
    return new GoogleGenAI({ apiKey: process.env["GOOGLE_GENERATIVE_AI_API_KEY"] });
}

export const getRealtimeConfig = async (chatTitle: string, chatId: string): Promise<Partial<RealtimeSessionOptions>> => {
    return {
        model: "gpt-4o-mini-realtime-preview",
        config: {
            modalities: ['audio', 'text'],
            inputAudioTranscription: { model: 'whisper-1' },
            voice: 'alloy',
            tracing: {
                workflow_name: chatTitle,
                group_id: chatId
            }
        },
    }
}
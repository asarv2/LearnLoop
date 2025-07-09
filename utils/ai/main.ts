import AsyncOpenAI from 'openai';
import { setDefaultOpenAIClient } from "@openai/agents";
import { GoogleGenAI } from "@google/genai";

export const openai = new AsyncOpenAI({
    apiKey: process.env["GEMINI_API_KEY"],
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});
setDefaultOpenAIClient(openai);

export const google = new GoogleGenAI({});

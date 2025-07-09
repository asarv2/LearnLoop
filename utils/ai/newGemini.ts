import AsyncOpenAI from 'openai';
import { setDefaultOpenAIClient } from "@openai/agents";

const openai = new AsyncOpenAI({
    apiKey: process.env["GEMINI_API_KEY"],
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

setDefaultOpenAIClient(openai);

export default openai;
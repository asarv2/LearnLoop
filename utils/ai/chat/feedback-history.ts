// utils/ai/chat/feedback-history.ts
// Generates a history of the feedback for the chat

import { Chat } from "@/types";
import { AgentInputItem } from "@openai/agents";

export const generateFeedbackHistory = async (chat: Chat): Promise<AgentInputItem> => {
    if (chat.type === 'cheating') {
        return {
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: `Analyze this job interview conversation and provide detailed, specific feedback on the interviewer's performance: \n\nIMPORTANT CONTEXT: This candidate was actually using AI assistance tools (like Cluealy) during the interview. In your analysis, specifically evaluate whether the interviewer detected signs of AI assistance and how they could have identified cheating behaviors.`
                }
            ]
        }
    } else {
        return {
            role: 'user',
            content: [
                {
                    type: 'input_text',
                    text: `Analyze this job interview conversation and provide detailed, specific feedback on the interviewer's performance: \n\nIMPORTANT CONTEXT: This candidate may or may not have been using AI assistance. Evaluate whether the interviewer looked for potential signs of AI assistance or cheating.`
                }
            ]
        }
    }
}
// utils/ai/chat/conversation-history.ts
// Generates a conversation history for the chat

import { Message } from "@/types";
import { AgentInputItem } from "@openai/agents";
import { RealtimeItem } from "@openai/agents/realtime";

export const generateConversationHistory = (messages: Message[]): AgentInputItem[] => {
    const conversationHistory: AgentInputItem[] = [];
    for (const message of messages) {
        if (message.role === "user" && message.content) {
            conversationHistory.push({
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: message.content,
                    }
                ]
            });
        } else if (message.role === "assistant" && message.content) {
            conversationHistory.push({
                role: "assistant",
                status: "completed",
                content: [
                    {
                        type: "input_text",
                        text: message.content,
                    }
                ]
            });
        }
    }
    return conversationHistory;
}


export const generateConversationHistoryRealtime = (messages: Message[]): RealtimeItem[] => {
    const conversationHistory: RealtimeItem[] = [];
    for (const message of messages) {
        if (message.role === "user" && message.content) {
            conversationHistory.push({
                type: "message",
                status: "completed",
                itemId: "user_message",
                role: "user",
                content: [{ type: "input_text", text: message.content }]
            });
        } else if (message.role === "assistant" && message.content) {
            conversationHistory.push({
                type: "message",
                status: "completed",
                itemId: "assistant_message",
                role: "assistant",
                content: [
                    { type: "text", text: message.content }
                ]
            });
        }
    }
    return conversationHistory;
}
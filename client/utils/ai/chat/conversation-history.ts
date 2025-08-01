// utils/ai/chat/conversation-history.ts
// Generates a conversation history for the chat

import { Message } from "@/types";
import { AgentInputItem } from "@openai/agents";
import { RealtimeItem } from "@openai/agents/realtime";

export const generateConversationHistory = (messages: Message[]): AgentInputItem[] => {
    const conversationHistory: AgentInputItem[] = [];
    for (const message of messages) {
        if (message.role === "user" && message.content && message.content.trim() !== "") {
            conversationHistory.push({
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: message.content,
                    }
                ]
            });
        } else if (message.role === "assistant" && message.content && message.content.trim() !== "") {
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
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (message.role === "user" && message.content && message.content.trim() !== "") {
            conversationHistory.push({
                type: "message",
                status: "completed",
                itemId: `user_message_${i}`,
                role: "user",
                content: [{ type: "input_text", text: message.content }]
            });
        } else if (message.role === "assistant" && message.content && message.content.trim() !== "") {
            conversationHistory.push({
                type: "message",
                status: "completed",
                itemId: `assistant_message_${i}`,
                role: "assistant",
                content: [
                    { type: "text", text: message.content }
                ]
            });
        }
    }
    return conversationHistory;
}

import { getMessagesByChat } from "@/utils/queries/messages/get-messages-by-chat";
import { generateConversationHistory } from "@/utils/ai/chat/conversation-history";
import { NextRequest, NextResponse } from "next/server";
import { getFeedbackAgent } from "@/utils/ai/agents/feedback";
import { AgentInputItem, Runner } from "@openai/agents";
import { createFeedback } from "@/utils/mutations/feedback/create-feedback";
import { generateResumeHistory } from "@/utils/ai/chat/resume-history";
import { getChat } from "@/utils/queries/chats/get-chat";
import { generateFeedbackHistory } from "@/utils/ai/chat/feedback-history";

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const chatId = formData.get("chatId") as string;
    const chat = await getChat(chatId);

    const messages = await getMessagesByChat(chatId);

    const resumeHistory = await generateResumeHistory(chat);
    const conversationHistory = generateConversationHistory(messages);
    const feedbackHistory = await generateFeedbackHistory(chat);

    const input: AgentInputItem[] = [
        resumeHistory,
        ...conversationHistory,
        feedbackHistory,
    ];  

    const agent = await getFeedbackAgent(chat.type === 'cheating');

    const runner = new Runner();

    const result = await runner.run(agent, input);

    // create new feedback entry
    const feedback = await createFeedback({
        chat_id: chatId,
        strengths: result.finalOutput?.strengths || [],
        errors: result.finalOutput?.errors || [],
        green_flags: result.finalOutput?.greenFlags || [],
        red_flags: result.finalOutput?.redFlags || [],
    });

    return NextResponse.json(feedback);
}
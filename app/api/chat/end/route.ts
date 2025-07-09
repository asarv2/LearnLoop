
import { getMessagesByChat } from "@/utils/queries/messages/get-messages-by-chat";
import { generateConversationHistory } from "@/utils/ai/chat/conversation-history";
import { NextRequest, NextResponse } from "next/server";
import { getFeedbackAgent } from "@/utils/ai/agents/feedback";
import { Runner } from "@openai/agents";
import { createFeedback } from "@/utils/mutations/feedback/create-feedback";

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const chatId = formData.get("chatId") as string;

    const messages = await getMessagesByChat(chatId);

    const conversationHistory = generateConversationHistory(messages);

    const agent = getFeedbackAgent();

    const runner = new Runner();

    const result = await runner.run(agent, conversationHistory);

    // create new feedback entry
    const feedback = await createFeedback({
        chat_id: chatId,
        strengths: result.finalOutput?.strengths?.join(", ") || "",
        errors: result.finalOutput?.errors?.join(", ") || "",
        green_flags: result.finalOutput?.greenFlags?.join(", ") || "",
        red_flags: result.finalOutput?.redFlags?.join(", ") || "",
    });

    return NextResponse.json(feedback);
}
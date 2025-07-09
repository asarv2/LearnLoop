// app/api/chat/message/route.ts

import { Agent, AgentInputItem, Runner } from "@openai/agents";
import { getChat } from "@/utils/queries/chats/get-chat";
import { createMessage } from "@/utils/mutations/messages/create-message";
import { NextRequest, NextResponse } from "next/server";
import { getCheatingAgent } from "@/utils/ai/agents/cheating";
import { getRegularAgent } from "@/utils/ai/agents/regular";
import { updateMessage } from "@/utils/mutations/messages/update-message";
import { generateConversationHistory } from "@/utils/ai/chat/conversation-history";
import { getMessagesByChat } from "@/utils/queries/messages/get-messages-by-chat";
import { generateResumeHistory } from "@/utils/ai/chat/resume-history";

export async function POST(request: NextRequest) {
    // use form data
    const formData = await request.formData();
    const chatId = formData.get("chatId");
    const messageInput = formData.get("message");

    const chat = await getChat(chatId as string);
    const messages = await getMessagesByChat(chatId as string);

    const interviewType = chat.type;

    let agent: Agent;
    if (interviewType === 'cheating') {
        agent = await getCheatingAgent();
    } else {
        agent = await getRegularAgent();
    }

    const resumeHistory = await generateResumeHistory(chat);
    const conversationHistory = generateConversationHistory(messages);

    const input: AgentInputItem[] = [
        resumeHistory,
        ...conversationHistory,
        {
            role: "user",
            content: messageInput as string,
        }
    ];

    const runner = new Runner();

    const result = await runner.run(
        agent,
        input,
        {
            stream: true,
        }
    );

    let messageText = "";
    const message = await createMessage({
        chat_id: chatId as string,
        content: "",
        role: "assistant"
    });
    for await (const event of result) {
        // these are the raw events from the model
        if (event.type === 'raw_model_stream_event') {
            if (event.data.type === 'output_text_delta') {
                messageText += event.data.delta;
            }
        }
    }

    await updateMessage(message.id, {
        content: messageText as string,
        completed: true,
        completed_at: new Date().toISOString(),
    });
    // TODO: make this a streaming response, for all the deltas above. Use SSE
    return NextResponse.json({ message });
}
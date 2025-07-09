// app/api/chat/message/route.ts

import { Agent, AgentInputItem, Runner } from "@openai/agents";
import { getChat } from "@/utils/queries/chats/get-chat";
import { createMessage } from "@/utils/mutations/messages/create-message";
import { NextRequest, NextResponse } from "next/server";
import { getCheatingAgent } from "@/utils/ai/agents/cheating";
import { getRegularAgent } from "@/utils/ai/agents/regular";
import { getValidResume } from "@/utils/google/get-valid-resume";

export async function POST(request: NextRequest) {
    // use form data
    const formData = await request.formData();
    const chatId = formData.get("chatId");
    const messageInput = formData.get("message");

    const chat = await getChat(chatId as string);

    const interviewType = chat.type;
    const candidateName = chat.name;
    const candidatePosition = chat.position;
    const additionalInstructions = chat.additional_info;

    if (!chat.resume_id) {
        return NextResponse.json({ error: "Chat does not have a resume" }, { status: 400 });
    }

    const resume = await getValidResume(chat.resume_id);


    let agent: Agent;
    if (interviewType === 'cheating') {
        agent = await getCheatingAgent();
    } else {
        agent = await getRegularAgent();
    }

    const input: AgentInputItem[] = [
        {
            role: "user",
            content: messageInput as string,
        },
        {
        role: "user",
        content: [
            {
                type: "input_text",
                text: `
                You are interviewing ${candidateName} for the position of ${candidatePosition}.
                ${additionalInstructions}
                `,
            },
            {
                type: "input_image",
                image: `https://generativelanguage.googleapis.com/v1beta/${resume.google_file_id}`,
            }
        ]
    }];

    const runner = new Runner();

    const result = await runner.run(
        agent,
        input,
        {
            stream: true,
        }
    );

    let messageText = "";
    for await (const event of result) {
        // these are the raw events from the model
        if (event.type === 'raw_model_stream_event') {
            if (event.data.type === 'output_text_delta') {
                messageText += event.data.delta;
            }
        }
        // agent updated events
        if (event.type == 'agent_updated_stream_event') {
          console.log(`${event.type} %s`, event.agent.name);
        }
        // Agent SDK specific events
        if (event.type === 'run_item_stream_event') {
          console.log(`${event.type} %o`, event.item);
        }
      }

    const message = await createMessage({
        chat_id: chatId as string,
        content: messageText as string,
        role: "assistant",
    });
    return NextResponse.json({ message });
}
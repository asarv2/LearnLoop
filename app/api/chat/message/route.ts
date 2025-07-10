// app/api/chat/message/route.ts

import { Agent, AgentInputItem, Runner } from "@openai/agents";
import { getChat } from "@/utils/queries/chats/get-chat";
import { createMessage } from "@/utils/mutations/messages/create-message";
import { NextRequest } from "next/server";
import { getCheatingAgent } from "@/utils/ai/agents/cheating";
import { getRegularAgent } from "@/utils/ai/agents/regular";
import { updateMessage } from "@/utils/mutations/messages/update-message";
import { generateConversationHistory } from "@/utils/ai/chat/conversation-history";
import { getMessagesByChat } from "@/utils/queries/messages/get-messages-by-chat";
import { generateResumeHistory } from "@/utils/ai/chat/resume-history";
import { logError } from "@/utils/logger";

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

    // create user message
    await createMessage({
        chat_id: chatId as string,
        content: messageInput as string,
        role: "user",
        completed: true
    });

    // Create the initial message in the database
    const message = await createMessage({
        chat_id: chatId as string,
        content: "",
        role: "assistant",
        completed: false
    });

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            let messageText = "";
            
            try {
                // Send the initial message ID
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'message_created', 
                    messageId: message.id 
                })}\n\n`));

                for await (const event of result) {
                    // these are the raw events from the model
                    if (event.type === 'raw_model_stream_event') {
                        if (event.data.type === 'output_text_delta') {
                            messageText += event.data.delta;
                            
                            // Send the delta to the client
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                                type: 'content_delta', 
                                delta: event.data.delta,
                                content: messageText 
                            })}\n\n`));
                        }
                    }
                }

                // Update the message as completed
                await updateMessage(message.id, {
                    content: messageText,
                    completed: true,
                    completed_at: new Date().toISOString(),
                });

                // Send completion signal
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'message_completed',
                    messageId: message.id,
                    content: messageText
                })}\n\n`));

            } catch (error) {
                logError('Streaming error:', error);
                
                // Update message with error state
                await updateMessage(message.id, {
                    content: messageText || "Sorry, I encountered an error while processing your message.",
                    completed: true,
                    completed_at: new Date().toISOString(),
                });

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'error',
                    error: 'Failed to generate response'
                })}\n\n`));
            } finally {
                controller.close();
            }
        }
    });

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
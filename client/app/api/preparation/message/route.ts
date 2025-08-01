// app/api/preparation/message/route.ts

import { Agent, AgentInputItem, Runner } from "@openai/agents";
import { getChat } from "@/utils/queries/chats/get-chat";
import { createMessage } from "@/utils/mutations/messages/create-message";
import { NextRequest } from "next/server";
import { getPreparationCandidateAgent } from "@/utils/ai/agents/preparation-candidate";
import { getInterviewerAgent } from "@/utils/ai/agents/interviewer";
import { getOffboardingManagerAgent } from "@/utils/ai/agents/offboarding-manager";
import { getOffboardingEmployeeAgent } from "@/utils/ai/agents/offboarding-employee";
import { updateMessage } from "@/utils/mutations/messages/update-message";
import { getMessagesByChat } from "@/utils/queries/messages/get-messages-by-chat";
import { logError } from "@/utils/logger";
import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";

export async function POST(request: NextRequest) {
    // Check authentication
    const supabase = await supabaseServer(cookies());
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // use form data
                const formData = await request.formData();
            const chatId = formData.get("chatId");
            const jobPosition = formData.get("jobPosition") as string;
            const offboardingType = formData.get("offboardingType") as string;
            const employeeLevel = formData.get("employeeLevel") as string;

    // Get chat info
    const chat = await getChat(chatId as string);
    const messages = await getMessagesByChat(chatId as string);
    
    // Determine which agent should respond next
    // Even number of messages (0, 2, 4...) = first agent's turn (interviewer/manager)
    // Odd number of messages (1, 3, 5...) = second agent's turn (candidate/employee)
    const shouldFirstAgentRespond = messages.length % 2 === 0;
    
    // Determine if this is an interview or offboarding preparation
    const isInterviewPrep = chat.title?.includes('Interview') || chat.additional_info?.includes('interview-prep');
    const isOffboardingPrep = chat.title?.includes('Offboarding') || chat.additional_info?.includes('offboarding-prep');
    
    let agent: Agent;
    
    if (shouldFirstAgentRespond) {
        // First agent should respond (interviewer or manager)
        if (isOffboardingPrep) {
            agent = await getOffboardingManagerAgent(offboardingType || 'voluntary', employeeLevel || 'MID-LEVEL');
        } else {
            agent = await getInterviewerAgent(jobPosition);
        }
    } else {
        // Second agent should respond (candidate or employee)
        if (isOffboardingPrep) {
            agent = await getOffboardingEmployeeAgent(offboardingType || 'voluntary', employeeLevel || 'MID-LEVEL');
        } else {
            agent = await getPreparationCandidateAgent(jobPosition);
        }
    }

    // Create the initial message in the database with the correct role
    const nextMessage = await createMessage({
        chat_id: chatId as string,
        content: "",
        role: "assistant", // Both agents respond as assistant, but we'll distinguish by index
        completed: false,
        training_id: chat.training_id,
    });

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            try {
                // Send the initial message ID
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'assistant_message_created', 
                    messageId: nextMessage.id 
                })}\n\n`));

                // Build a simple conversation context
                const input: AgentInputItem[] = [];
                
                if (messages.length === 0) {
                    // First message - first agent starts the conversation
                    if (isOffboardingPrep) {
                        input.push({
                            role: "user",
                            content: [
                                {
                                    type: "input_text",
                                    text: `Start the offboarding conversation for a ${employeeLevel || 'MID-LEVEL'} employee with a ${offboardingType || 'voluntary'} departure. Begin with a warm, professional greeting and acknowledge their contributions. Demonstrate excellent offboarding techniques from the very beginning. Speak naturally without any placeholder text or formatting.`
                                }
                            ]
                        });
                    } else {
                        input.push({
                            role: "user",
                            content: [
                                {
                                    type: "input_text",
                                    text: `Start the interview for the ${jobPosition} position with a warm, professional greeting and ask the candidate to introduce themselves. Demonstrate excellent interviewing techniques from the very beginning. Speak naturally without any placeholder text or formatting.`
                                }
                            ]
                        });
                    }
                } else {
                    // Get the last message to provide context
                    const lastMessage = messages[messages.length - 1];
                    
                    if (shouldFirstAgentRespond) {
                        // First agent is responding (interviewer or manager)
                        if (isOffboardingPrep) {
                            input.push({
                                role: "user",
                                content: [
                                    {
                                        type: "input_text",
                                        text: `You are the MANAGER conducting a ${offboardingType || 'voluntary'} offboarding for a ${employeeLevel || 'MID-LEVEL'} employee. The employee just said: "${lastMessage.content}"

Continue the offboarding conversation by addressing their concerns, explaining next steps, or moving to the next topic. Demonstrate excellent offboarding techniques including empathy, clear communication, and professional handling of sensitive situations. Keep the conversation flowing naturally and show how to conduct a professional offboarding. Speak naturally without any placeholder text or formatting.`
                                    }
                                ]
                            });
                        } else {
                            input.push({
                                role: "user",
                                content: [
                                    {
                                        type: "input_text",
                                        text: `You are the INTERVIEWER for the ${jobPosition} position. The candidate just said: "${lastMessage.content}"

Continue the interview by asking a follow-up question or moving to the next topic. Demonstrate excellent interviewing techniques including active listening, proper follow-up questions, and professional conduct. Keep the conversation flowing naturally and show how to conduct a professional interview. Speak naturally without any placeholder text or formatting.`
                                    }
                                ]
                            });
                        }
                    } else {
                        // Second agent is responding (candidate or employee)
                        if (isOffboardingPrep) {
                            input.push({
                                role: "user",
                                content: [
                                    {
                                        type: "input_text",
                                        text: `You are the EMPLOYEE being offboarded with a ${offboardingType || 'voluntary'} departure at the ${employeeLevel || 'MID-LEVEL'} level. The manager just said: "${lastMessage.content}"

Respond naturally and conversationally. Keep your response DETAILED (3-6 sentences) and authentic. Show appropriate emotions and concerns for the offboarding situation. Ask relevant questions about next steps, benefits, and transition planning. Don't use any formatting, placeholder text, or mention specific companies/projects you don't know. Just be yourself - speak like a real person in an offboarding conversation.`
                                    }
                                ]
                            });
                        } else {
                            input.push({
                                role: "user",
                                content: [
                                    {
                                        type: "input_text",
                                        text: `You are the CANDIDATE interviewing for the ${jobPosition} position. The interviewer just said: "${lastMessage.content}"

Respond naturally and conversationally. Keep your response DETAILED (3-6 sentences) and authentic. Show enthusiasm for the opportunity and why you're a good fit. Provide specific examples and detailed stories that demonstrate your expertise. Don't use any formatting, placeholder text, or mention specific companies/projects you don't know. Just be yourself - speak like a real person in an interview.`
                                    }
                                ]
                            });
                        }
                    }
                }

                let runner: Runner;

                if (chat.trace_id) {
                    runner = new Runner({
                        traceId: chat.trace_id
                    });
                } else {
                    runner = new Runner();
                }

                let result;
                let retryCount = 0;
                const maxRetries = 3;
                
                while (retryCount < maxRetries) {
                    try {
                        result = await runner.run(
                            agent,
                            input,
                            {
                                stream: true,
                            }
                        );
                        break; // Success, exit the retry loop
                    } catch (error) {
                        retryCount++;
                        if (error instanceof Error && error.message.includes('429') && retryCount < maxRetries) {
                            // Wait longer for rate limit errors
                            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                            continue;
                        } else {
                            throw error; // Re-throw if not a rate limit error or max retries reached
                        }
                    }
                }

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

                let messageText = "";
                
                for await (const event of result || []) {
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
                await updateMessage(nextMessage.id, {
                    content: messageText,
                    completed: true,
                    completed_at: new Date().toISOString(),
                });

                // Send completion signal
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'message_completed',
                    messageId: nextMessage.id,
                    content: messageText
                })}\n\n`));

            } catch (error) {
                logError('Streaming error:', error);
                
                // Provide more specific error messages based on the error type
                let errorMessage = "I'm having trouble responding right now. Let me try again.";
                
                if (error instanceof Error && error.message.includes('429')) {
                    errorMessage = "I'm a bit busy right now. Let me take a moment and try again.";
                } else if (error instanceof Error && error.message.includes('400')) {
                    errorMessage = "I need to rephrase that. Let me try a different approach.";
                } else if (error instanceof Error && error.message.includes('Max turns')) {
                    errorMessage = "Let me continue the conversation naturally.";
                }
                
                // Update message with error state
                await updateMessage(nextMessage.id, {
                    content: errorMessage,
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

import { getMessagesByChat } from "@/utils/queries/messages/get-messages-by-chat";
import { generateConversationHistory } from "@/utils/ai/chat/conversation-history";
import { NextRequest, NextResponse } from "next/server";
import { getFeedbackAgent } from "@/utils/ai/agents/feedback";
import { AgentInputItem, Runner } from "@openai/agents";
import { createFeedback } from "@/utils/mutations/feedback/create-feedback";
import { generateResumeHistory } from "@/utils/ai/chat/resume-history";
import { getChat } from "@/utils/queries/chats/get-chat";
import { generateFeedbackHistory } from "@/utils/ai/chat/feedback-history";
import { updateChat } from "@/utils/mutations/chats/update-chat";
import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const supabase = await supabaseServer(cookies());
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const chatId = formData.get("chatId") as string;
        
        if (!chatId) {
            return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
        }

        const chat = await getChat(chatId);
        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        const messages = await getMessagesByChat(chatId);

        const resumeHistory = await generateResumeHistory(chat);
        const conversationHistory = generateConversationHistory(messages);
        const feedbackHistory = await generateFeedbackHistory(chat);

        const input: AgentInputItem[] = [
            resumeHistory,
            ...conversationHistory,
            feedbackHistory,
        ];  

        // Use the training_type field from the chat, fallback to title parsing for backward compatibility
        const trainingType = chat.training_type || (chat.title.startsWith('Offboarding:') ? 'offboarding' : 'interview');
        const agent = await getFeedbackAgent(trainingType, chat.type === 'cheating');

        let runner: Runner;
        if (chat.trace_id) {
            runner = new Runner({
                workflowName: chat.title,
                groupId: chat.id,
                traceId: chat.trace_id
            });
        } else {
            runner = new Runner();
        }

        const result = await runner.run(agent, input);

        // create new feedback entry
        const feedback = await createFeedback({
            chat_id: chatId,
            training_id: chat.training_id,
            strengths: result.finalOutput?.strengths || [],
            errors: result.finalOutput?.errors || [],
            green_flags: result.finalOutput?.greenFlags || [],
            red_flags: result.finalOutput?.redFlags || [],
        });

        // mark chat as completed
        await updateChat(chatId, {
            completed: true,
            completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            feedback: feedback
        });
    } catch (error) {
        logError('Error in /api/chat/end:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to end interview and generate feedback'
        }, { status: 500 });
    }
}
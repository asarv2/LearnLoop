// app/api/preparation/start/route.ts

import { TrainingType } from "@/types";
import { createChat } from "@/utils/mutations/chats/create-chat";
import { createMessage } from "@/utils/mutations/messages/create-message";
import { createTraining } from "@/utils/mutations/trainings/create-training";
import { generateTraceId } from "@openai/agents";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";

export async function POST(request: NextRequest) {
    // Get the current user from the session
    const supabase = await supabaseServer(cookies());
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const preparationType = formData.get("type") as string;
    const training_type = 'preparation' as TrainingType;

    let chatTitle: string;
    let initialMessage: string;

    // Handle different preparation types
    switch (preparationType) {
        case 'interview-prep':
            chatTitle = `Interview Preparation Demonstration`;
            initialMessage = "Hello! I'm Sarah, and I'll be interviewing you today for the Senior Software Engineer position. Thank you for taking the time to meet with me. I'd love to start by learning a bit more about your background and what interests you about this role.";
            break;
        case 'offboarding-prep':
            chatTitle = `Employee Offboarding Preparation Demonstration`;
            initialMessage = "Hello! I'm here to help you prepare for employee offboarding scenarios. I'll demonstrate best practices for handling sensitive departures and explain the key principles. How would you like to begin this preparation session?";
            break;
        case 'leadership-prep':
            chatTitle = `Leadership Development Preparation Demonstration`;
            initialMessage = "Hello! I'm here to help you prepare for leadership development scenarios. I'll demonstrate effective leadership techniques and explain key principles. How would you like to begin this preparation session?";
            break;
        case 'decision-making-prep':
            chatTitle = `Decision Making Preparation Demonstration`;
            initialMessage = "Hello! I'm here to help you prepare for decision-making scenarios. I'll demonstrate structured approaches and explain key frameworks. How would you like to begin this preparation session?";
            break;
        case 'group-discussion-prep':
            chatTitle = `Group Discussion Preparation Demonstration`;
            initialMessage = "Hello! I'm here to help you prepare for group discussion facilitation. I'll demonstrate effective facilitation techniques and explain key principles. How would you like to begin this preparation session?";
            break;
        default:
            chatTitle = `Preparation Demonstration`;
            initialMessage = "Hello! I'm here to help you prepare for various workplace scenarios. How would you like to begin this preparation session?";
    }

    // getting trace id
    const traceId = generateTraceId();

    // Create the training record
    const training = await createTraining({
        type: training_type,
        title: chatTitle,
        user_id: user.id,
        additional_info: {
            preparation_type: preparationType
        }
    });

    // create a new chat
    const chat = await createChat({
        title: chatTitle,
        resume_id: null,
        trace_id: traceId,
        name: "Preparation Session",
        position: "Preparation",
        type: "preparation",
        training_type: training_type,
        training_id: training.id,
        additional_info: JSON.stringify({
            preparation_type: preparationType
        }),
        user_id: user.id,
    });

    // create a message from the assistant (interviewer)
    await createMessage({
        chat_id: chat.id,
        content: initialMessage,
        role: "assistant",
        completed: true,
        training_id: training.id,
    });
    
    return NextResponse.json({ success: true, chatId: chat.id, trainingId: training.id });
} 
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
            const jobPosition = formData.get("jobPosition") as string;
            const offboardingType = formData.get("offboardingType") as string;
            const employeeLevel = formData.get("employeeLevel") as string;
    const training_type = 'preparation' as TrainingType;

    let chatTitle: string;
    let initialMessage: string;

    // Handle different preparation types
    switch (preparationType) {
        case 'interview-prep':
            chatTitle = `Interview Preparation Demonstration`;
            break;
        case 'offboarding-prep':
            chatTitle = `Employee Offboarding Preparation Demonstration`;
            break;
        case 'leadership-prep':
            chatTitle = `Leadership Development Preparation Demonstration`;
            break;
        case 'decision-making-prep':
            chatTitle = `Decision Making Preparation Demonstration`;
            break;
        case 'group-discussion-prep':
            chatTitle = `Group Discussion Preparation Demonstration`;
            break;
        default:
            chatTitle = `Preparation Demonstration`;
    }

    // getting trace id
    const traceId = generateTraceId();

    // Create the training record
    const training = await createTraining({
        type: training_type,
        title: chatTitle,
        user_id: user.id,
        additional_info: {
            preparation_type: preparationType,
            job_position: jobPosition,
            offboarding_type: offboardingType,
            employee_level: employeeLevel
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
            preparation_type: preparationType,
            job_position: jobPosition,
            offboarding_type: offboardingType,
            employee_level: employeeLevel
        }),
        user_id: user.id,
    });

    // Don't create an initial message - let the conversation start naturally
    
    return NextResponse.json({ success: true, chatId: chat.id, trainingId: training.id });
} 
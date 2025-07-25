// app/api/chat/start/route.ts

import { InterviewType, TrainingType } from "@/types";
import { uploadResume } from "@/utils/google/upload-resume";
import { createChat } from "@/utils/mutations/chats/create-chat";
import { createMessage } from "@/utils/mutations/messages/create-message";
import { createResume } from "@/utils/mutations/resumes/create-resume";
import { createTraining } from "@/utils/mutations/trainings/create-training";
import { extractTextFromPDF } from "@/utils/pdf/extract";
import { uploadResumeToSupabase } from "@/utils/storage/upload-resume-to-supabase";
import { generateTraceId } from "@openai/agents";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { Json } from "@/database.types";
import { logError } from "@/utils/logger";

export async function POST(request: NextRequest) {
    try {
        // Get the current user from the session
        const supabase = await supabaseServer(cookies());
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const name = formData.get("name") as string;
        const interviewType = formData.get("type") as InterviewType;
        const position = formData.get("position") as string;
        const position_level = formData.get("position_level") as string;
        const training_type = formData.get("training_type") as TrainingType || 'interview';
        const offboarding_type = formData.get("offboarding_type") as string;
        const employee_level = formData.get("employee_level") as string;

        // Validate required fields
        if (!name || !position || !interviewType) {
            return NextResponse.json({ error: 'Missing required fields: name, position, or type' }, { status: 400 });
        }

        let resume_id: string | null = null;
        let chatTitle: string;
        let initialMessage: string;
        let trainingAdditionalInfo: Json = {};

        // Handle different training types
        if (training_type === 'offboarding') {
            // For offboarding training, we don't need a resume
            chatTitle = `Offboarding: ${name} - ${position}`;
            initialMessage = "Hi, thanks for meeting with me. What did you want to discuss?";
            
            // Store offboarding-specific info
            trainingAdditionalInfo = {
                offboarding_type: offboarding_type,
                employee_level: employee_level,
                position_level: position_level // Keep for compatibility
            };
        } else {
            resume_id = null; // We'll set this after creating the training
            chatTitle = `Interview: ${name} - ${position}`;
            initialMessage = "Hello! Thank you for taking the time to meet with me today.";
            
            trainingAdditionalInfo = {
                position_level: position_level
            };
        }

        // getting trace id
        const traceId = generateTraceId();

        // Create the training record first
        const training = await createTraining({
            type: training_type,
            title: chatTitle,
            user_id: user.id,
            additional_info: trainingAdditionalInfo
        });

        // For interview training, create the resume and link it to the training
        if (training_type === 'interview') {
            const resumeFile = await formData.get("resume") as File;
            if (!resumeFile) {
                return NextResponse.json({ error: 'Resume file is required for interview training' }, { status: 400 });
            }
            
            const resumeBuffer = await resumeFile.arrayBuffer();
            const content = await extractTextFromPDF(Buffer.from(resumeBuffer));
            const googleFileId = await uploadResume(formData);
            
            const resume = await createResume({
                google_file_id: googleFileId,
                content: content,
                user_id: user.id,
                training_id: training.id,
            });
            
            // use the resume id to upload to supabase
            await uploadResumeToSupabase(resume.id, formData);
            resume_id = resume.id;
        }

        // create a new chat
        const chat = await createChat({
            title: chatTitle,
            resume_id: resume_id,
            trace_id: traceId,
            name: name as string,
            position: position as string,
            type: interviewType,
            training_type: training_type,
            training_id: training.id,
            additional_info: JSON.stringify(trainingAdditionalInfo),
            user_id: user.id,
        });

        // create a message from the assistant
        await createMessage({
            chat_id: chat.id,
            content: initialMessage,
            role: "assistant",
            completed: true,
            training_id: training.id,
        });
        
        return NextResponse.json({ success: true, chatId: chat.id, trainingId: training.id });
    } catch (error) {
        logError('Error in /api/chat/start:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to start interview'
        }, { status: 500 });
    }
}
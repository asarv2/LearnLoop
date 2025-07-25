// app/api/chat/start/route.ts

import { InterviewType } from "@/types";
import { uploadResume } from "@/utils/google/upload-resume";
import { createChat } from "@/utils/mutations/chats/create-chat";
import { createMessage } from "@/utils/mutations/messages/create-message";
import { createResume } from "@/utils/mutations/resumes/create-resume";
import { extractTextFromPDF } from "@/utils/pdf/extract";
import { uploadResumeToSupabase } from "@/utils/storage/upload-resume-to-supabase";
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
    const name = formData.get("name") as string;
    const interviewType = formData.get("type") as InterviewType;
    const position = formData.get("position") as string;
    const position_level = formData.get("position_level") as string;
    const training_type = formData.get("training_type") as string;
    const offboarding_type = formData.get("offboarding_type") as string;
    const employee_level = formData.get("employee_level") as string;

    let resume_id: string | null = null;
    let chatTitle: string;
    let initialMessage: string;

    // Handle different training types
    if (training_type === 'offboarding') {
        // For offboarding training, we don't need a resume
        chatTitle = `Offboarding: ${name} - ${position}`;
        initialMessage = "Hi, thanks for meeting with me. What did you want to discuss?";
        
        // Store offboarding-specific info in additional_info as JSON
        const offboardingInfo = {
            offboarding_type: offboarding_type,
            employee_level: employee_level,
            position_level: position_level // Keep for compatibility
        };
        
        // getting trace id
        const traceId = generateTraceId();

        // create a new chat
        const chat = await createChat({
            title: chatTitle,
            resume_id: null,
            trace_id: traceId,
            name: name as string,
            position: position as string,
            type: interviewType,
            additional_info: JSON.stringify(offboardingInfo),
            user_id: user.id,
        });

        // create a message from the assistant
        await createMessage({
            chat_id: chat.id,
            content: initialMessage,
            role: "assistant",
            completed: true,
        });
        
        return NextResponse.json({ success: true, chatId: chat.id });
    } else {
        // Original interview training flow
        const googleFileId = await uploadResume(formData);

        // finding resume text, convert to buffer
        const resumeFile = await formData.get("resume") as File;
        const resumeBuffer = await resumeFile.arrayBuffer();
        const content = await extractTextFromPDF(Buffer.from(resumeBuffer));
        const resume = await createResume({
            google_file_id: googleFileId,
            content: content,
            user_id: user.id,
        });
        // use the resume id to upload to supabase
        await uploadResumeToSupabase(resume.id, formData);

        resume_id = resume.id;
        chatTitle = `Interview: ${name} - ${position}`;
        initialMessage = "Hello! Thank you for taking the time to meet with me today.";

        // getting trace id
        const traceId = generateTraceId();

        // create a new chat
        const chat = await createChat({
            title: chatTitle,
            resume_id: resume_id,
            trace_id: traceId,
            name: name as string,
            position: position as string,
            type: interviewType,
            additional_info: position_level,
            user_id: user.id,
        });

        // create a message from the assistant saying "Hello! Thank you for taking the time to meet with me today."
        await createMessage({
            chat_id: chat.id,
            content: initialMessage,
            role: "assistant",
            completed: true,
        });
        
                 return NextResponse.json({ success: true, chatId: chat.id });
    }
}
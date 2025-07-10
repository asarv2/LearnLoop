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

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const interviewType = formData.get("type") as InterviewType;
    const position = formData.get("position") as string;
    const additional_info = formData.get("additional_info") as string;
    const googleFileId = await uploadResume(formData);

    // finding resume text, convert to buffer
    const resumeFile = await formData.get("resume") as File;
    const resumeBuffer = await resumeFile.arrayBuffer();
    const content = await extractTextFromPDF(Buffer.from(resumeBuffer));
    const resume = await createResume({
        google_file_id: googleFileId,
        content: content,
    });
    // use the resume id to upload to supabase
    await uploadResumeToSupabase(resume.id, formData);

    // getting trace id
    const traceId = generateTraceId();

    // create a new chat
    const chat = await createChat({
        title: `Interview: ${name} - ${position}`,
        resume_id: resume.id,
        trace_id: traceId,
        name: name as string,
        position: position as string,
        type: interviewType,
        additional_info: additional_info,
    });

    // create a message from the assistant saying "Hello! Thank you for taking the time to meet with me today."
    await createMessage({
        chat_id: chat.id,
        content: "Hello! Thank you for taking the time to meet with me today.",
        role: "assistant",
        completed: true,
    });
    
    return NextResponse.json({ success: true, chatId: chat.id });
}
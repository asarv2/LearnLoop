// app/api/chat/start/route.ts

import { InterviewType } from "@/types";
import { uploadResume } from "@/utils/google/upload-resume";
import { createChat } from "@/utils/mutations/chats/create-chat";
import { createResume } from "@/utils/mutations/resumes/create-resume";
import { extractTextFromPDF } from "@/utils/pdf/extract";
import { uploadResumeToSupabase } from "@/utils/storage/upload-resume-to-supabase";
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

    // create a new chat
    const chat = await createChat({
        title: name as string,
        resume_id: resume.id,
        name: name as string,
        position: position as string,
        type: interviewType,
        additional_info: additional_info,
    });
    
    return NextResponse.json({ success: true, chatId: chat.id });
}
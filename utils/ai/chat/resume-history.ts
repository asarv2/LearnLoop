// utils/ai/chat/resume-history.ts
// Generates a history of the resume for the chat

import { Chat } from "@/types";
import { getValidResume } from "@/utils/google/get-valid-resume";
import { getResume } from "@/utils/queries/resumes/get-resume";
import { AgentInputItem, UserMessageItem } from "@openai/agents";
import { RealtimeItem, RealtimeMessageItem } from "@openai/agents/realtime";


export const generateResumeHistory = async (chat: Chat): Promise<AgentInputItem> => {
    type TextSection = UserMessageItem['content'][0];
    type ResumeSection = UserMessageItem['content'][0] | null;

    const candidateName = chat.name;
    const candidatePosition = chat.position;
    const additionalInstructions = chat.additional_info;

    const text_section: TextSection = {
        type: "input_text",
        text: `
        You are interviewing ${candidateName} for the position of ${candidatePosition}.
        ${additionalInstructions}`,
    }

    let resume_section: ResumeSection = null;
    if (chat.resume_id) {
        const resume = await getValidResume(chat.resume_id);
        resume_section = {
            type: "input_image",
            image: `https://generativelanguage.googleapis.com/v1beta/${resume.google_file_id}`,
        }
    }

    return {
        role: "user",
        content: [text_section, resume_section!],
    }
};

export const generateResumeHistoryRealtime = async (chat: Chat): Promise<RealtimeItem> => {
    type TextSection = RealtimeMessageItem['content'][0];
    const candidateName = chat.name;
    const candidatePosition = chat.position;
    const additionalInstructions = chat.additional_info;

    const text_section: TextSection = {
        type: "input_text",
        text: `
        You are interviewing ${candidateName} for the position of ${candidatePosition}.
        ${additionalInstructions}`,
    }
    if (!chat.resume_id) {
        throw new Error("No resume id provided");
    }
    const resume = await getResume(chat.resume_id); // we just need the text

    const resume_section: TextSection = {
        type: "input_text",
        text: `
        Here is the resume of the candidate:
        ${resume.content}
        `,
    }

    return {
        type: "message",
        status: "completed",
        itemId: "resume_history",
        role: "user",
        content: [text_section, resume_section],
    }
};
// utils/ai/chat/resume-history.ts
// Generates a history of the resume for the chat

import { Chat } from "@/types";
import { getValidResume } from "@/utils/google/get-valid-resume";
import { AgentInputItem, UserMessageItem } from "@openai/agents";

type TextSection = UserMessageItem['content'][0];
type ImageSection = UserMessageItem['content'][0] | null;

export const generateResumeHistory = async (chat: Chat): Promise<AgentInputItem> => {
    const candidateName = chat.name;
    const candidatePosition = chat.position;
    const additionalInstructions = chat.additional_info;

    const text_section: TextSection = {
        type: "input_text",
        text: `
        You are interviewing ${candidateName} for the position of ${candidatePosition}.
        ${additionalInstructions}`,
    }
    let image_section: ImageSection = null;
    if (chat.resume_id) {
        const resume = await getValidResume(chat.resume_id);
        image_section = {
            type: "input_image",
            image: `https://generativelanguage.googleapis.com/v1beta/${resume.google_file_id}`,
        }
    }

    return {
        role: "user",
        content: [text_section, image_section!],
    }
};
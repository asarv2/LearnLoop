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
    
    // Check if this is offboarding training
    let additionalInfo;
    try {
        additionalInfo = JSON.parse(chat.additional_info);
    } catch {
        additionalInfo = null;
    }

    if (additionalInfo && additionalInfo.offboarding_type) {
        // This is offboarding training
        const text_section: TextSection = {
            type: "input_text",
            text: `
            You are ${candidateName}, an employee in the role of ${candidatePosition}.
            Offboarding Type: ${additionalInfo.offboarding_type}
            Employee Level: ${additionalInfo.employee_level}
            
            Your manager (the user) is going to conduct an offboarding conversation with you. They are practicing how to handle this type of departure professionally. You should respond authentically as the employee being offboarded, showing appropriate emotions and reactions for your situation.`,
        }

        return {
            role: "user",
            content: [text_section],
        }
    } else {
        // Original interview training flow
        const positionLevel = chat.additional_info; // This now contains the position level

        const text_section: TextSection = {
            type: "input_text",
            text: `
            You are acting as ${candidateName} for the position of ${candidatePosition}.
            ${positionLevel ? `Position Level: ${positionLevel}` : ''}
            The user will try to interview you as practice. Make sure to tailor your responses to match the specified position level while staying true to your character and the information in your resume.`,
        }

        let resume_section: ResumeSection = null;
        if (chat.resume_id) {
            const resume = await getValidResume(chat.resume_id);
            if (resume.google_file_id) {
                resume_section = {
                    type: "input_image",
                    image: `https://generativelanguage.googleapis.com/v1beta/${resume.google_file_id}`,
                }
            }
        }

        return {
            role: "user",
            content: [text_section, resume_section!],
        }
    }
};

export const generateResumeHistoryRealtime = async (chat: Chat): Promise<RealtimeItem> => {
    type TextSection = RealtimeMessageItem['content'][0];
    const candidateName = chat.name;
    const candidatePosition = chat.position;
    
    // Check if this is offboarding training
    let additionalInfo;
    try {
        additionalInfo = JSON.parse(chat.additional_info);
    } catch {
        additionalInfo = null;
    }

    if (additionalInfo && additionalInfo.offboarding_type) {
        // This is offboarding training
        const text_section: TextSection = {
            type: "input_text",
            text: `
            You are ${candidateName}, an employee in the role of ${candidatePosition}.
            Offboarding Type: ${additionalInfo.offboarding_type}
            Employee Level: ${additionalInfo.employee_level}
            
            Your manager (the user) is going to conduct an offboarding conversation with you. They are practicing how to handle this type of departure professionally. You should respond authentically as the employee being offboarded, showing appropriate emotions and reactions for your situation.`,
        }

        return {
            type: "message",
            status: "completed",
            itemId: "resume_history",
            role: "user",
            content: [text_section],
        }
    } else {
        // Original interview training flow
        const positionLevel = chat.additional_info; // This now contains the position level

        const text_section: TextSection = {
            type: "input_text",
            text: `
            You are interviewing ${candidateName} for the position of ${candidatePosition}.
            ${positionLevel ? `Position Level: ${positionLevel}` : ''}
            Make sure to tailor your responses to match the specified position level while staying true to your character and the information in your resume.`,
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
    }
};
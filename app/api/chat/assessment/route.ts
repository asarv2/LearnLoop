import { NextRequest, NextResponse } from "next/server";
import { createAssessment } from "@/utils/mutations/assessments/create-assessment";
import { createFeedback } from "@/utils/mutations/feedback/create-feedback";
import { updateChat } from "@/utils/mutations/chats/update-chat";
import { getChat } from "@/utils/queries/chats/get-chat";
import { getMessagesByChat } from "@/utils/queries/messages/get-messages-by-chat";
import { generateResumeHistory } from "@/utils/ai/chat/resume-history";
import { generateConversationHistory } from "@/utils/ai/chat/conversation-history";
import { getFeedbackAgent } from "@/utils/ai/agents/feedback";
import { AgentInputItem, Runner } from "@openai/agents";
import { AssessmentResponse } from "@/types";
import { ASSESSMENT_QUESTIONS } from "@/utils/assessment/questions";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { chatId, responses } = body as { 
            chatId: string; 
            responses: AssessmentResponse[];
        };

        const chat = await getChat(chatId);
        const messages = await getMessagesByChat(chatId);

        // Store the assessment responses
        await createAssessment({
            chat_id: chatId,
            responses: responses
        });

        // Generate feedback based on assessment responses
        const resumeHistory = await generateResumeHistory(chat);
        const conversationHistory = generateConversationHistory(messages);
        
        // Create assessment context for the AI
        const assessmentContext = generateAssessmentContext(responses, chat.type);

        const input: AgentInputItem[] = [
            resumeHistory,
            ...conversationHistory,
            assessmentContext,
        ];

        const agent = await getFeedbackAgent(chat.type === 'cheating' || chat.type === 'ai-assisted');

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

        // Create new feedback entry
        const feedback = await createFeedback({
            chat_id: chatId,
            strengths: result.finalOutput?.strengths || [],
            errors: result.finalOutput?.errors || [],
            green_flags: result.finalOutput?.greenFlags || [],
            red_flags: result.finalOutput?.redFlags || [],
        });

        // Mark chat as completed
        await updateChat(chatId, {
            completed: true,
            completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            feedback: feedback
        });

    } catch (error) {
        console.error('Error processing assessment:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to process assessment and generate feedback'
        }, { status: 500 });
    }
}

function generateAssessmentContext(responses: AssessmentResponse[], interviewType: string): AgentInputItem {
    const responseMap = new Map(responses.map(r => [r.question_id, r.response]));
    
    // Build context based on the interviewer's responses
    let contextText = "INTERVIEWER ASSESSMENT RESPONSES:\n\n";
    
    ASSESSMENT_QUESTIONS.forEach(question => {
        const response = responseMap.get(question.id);
        if (response !== undefined) {
            contextText += `Q: ${question.question}\n`;
            contextText += `A: ${response}\n\n`;
        }
    });

    // Add specific insights based on key responses
    const hireDecision = responseMap.get('hire_decision');
    const cheatingSuspicion = responseMap.get('cheating_suspicion');
    const authenticityRating = responseMap.get('authenticity_rating');
    const redFlags = responseMap.get('red_flags');

    contextText += "ANALYSIS FOCUS:\n";
    
    if (interviewType === 'cheating' || interviewType === 'ai-assisted') {
        contextText += `- This candidate WAS using AI assistance during the interview\n`;
        contextText += `- Interviewer's cheating suspicion: ${cheatingSuspicion || 'Not provided'}\n`;
        contextText += `- Interviewer's authenticity rating: ${authenticityRating || 'Not provided'}/5\n`;
        contextText += `- Red flags noticed: ${redFlags || 'None specified'}\n`;
        contextText += `- Evaluate whether the interviewer successfully detected the AI assistance\n`;
        contextText += `- Provide feedback on missed opportunities to identify cheating behaviors\n`;
    } else {
        contextText += `- This candidate was NOT using AI assistance\n`;
        contextText += `- Interviewer's authenticity rating: ${authenticityRating || 'Not provided'}/5\n`;
        contextText += `- Red flags noticed: ${redFlags || 'None specified'}\n`;
        contextText += `- Evaluate the interviewer's assessment accuracy\n`;
        contextText += `- Note if they incorrectly suspected cheating (false positive)\n`;
    }

    contextText += `\nHiring decision: ${hireDecision || 'Not provided'}\n`;
    contextText += `\nPlease provide feedback that:\n`;
    contextText += `1. Evaluates the interviewer's detection skills specifically\n`;
    contextText += `2. Explains what they did well in their assessment\n`;
    contextText += `3. Points out missed opportunities or incorrect judgments\n`;
    contextText += `4. Provides actionable advice for improving cheating detection\n`;
    contextText += `5. Comments on the appropriateness of their hiring decision\n`;

    return {
        role: 'user',
        content: [
            {
                type: 'input_text',
                text: contextText
            }
        ]
    };
} 
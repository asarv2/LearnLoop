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
import { Assessment } from "@/types";
import { STATIC_ASSESSMENT_QUESTIONS, AssessmentQuestion } from "@/utils/assessment/questions";
import { Json } from "@/database.types";
import { logError } from "@/utils/logger";
import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const supabase = await supabaseServer(cookies());
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { chatId, responses } = body as { 
            chatId: string; 
            responses: Assessment['responses'];
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
        // Determine training type first
        const isOffboardingTraining = chat.title.startsWith('Offboarding:');
        
        const conversationHistory = generateConversationHistory(messages);
        
        // Create assessment context for the AI
        const assessmentContext = await generateAssessmentContext(responses, chat.type, messages, isOffboardingTraining);

        const input: AgentInputItem[] = [
            resumeHistory,
            ...conversationHistory,
            assessmentContext,
        ];

        // Determine training type and cheating flag
        const trainingType = isOffboardingTraining ? 'offboarding' : 'interview';
        const agent = await getFeedbackAgent(trainingType, chat.type === 'cheating' || chat.type === 'ai-assisted');

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

        // Generate and store interview score
        try {
            // Import scoring logic directly instead of making HTTP request
            const { getScoringAgent } = await import('@/utils/ai/agents/scoring');
            const { createInterviewScore } = await import('@/utils/mutations/scores/create-interview-score');

            // Get the scoring agent with training type
            const scoringAgent = await getScoringAgent(trainingType);

            // Prepare conversation context with appropriate labels
            const conversationContext = messages
                .filter((msg) => msg.completed !== false && msg.content?.trim())
                .map((msg) => {
                    if (isOffboardingTraining) {
                        return `${msg.role === 'user' ? 'Manager' : 'Employee'}: ${msg.content}`;
                    } else {
                        return `${msg.role === 'user' ? 'Interviewer' : 'Interviewee'}: ${msg.content}`;
                    }
                })
                .join('\n\n');

            // Prepare assessment context
            const assessmentContext = Array.isArray(responses) 
                ? responses.map((response: any) => `Q: ${response.question_id}\nA: ${response.response}`).join('\n\n')
                : '';

            let prompt: string;
            
            if (isOffboardingTraining) {
                prompt = `
OFFBOARDING EVALUATION REQUEST

OFFBOARDING CONTEXT:
- Employee Role: ${chat.title.replace('Offboarding: ', '').split(' - ')[1] || 'Unknown'}
- Employee Name: ${chat.title.replace('Offboarding: ', '').split(' - ')[0] || 'Unknown'}
- Total Messages: ${messages.length}

COMPLETE OFFBOARDING CONVERSATION:
${conversationContext}

MANAGER'S ASSESSMENT RESPONSES:
${assessmentContext}

Please evaluate this manager's performance across all 6 offboarding management categories using the rubric. Consider:
- How professionally they handled the offboarding
- Their empathy and emotional intelligence
- Legal compliance and procedural adherence
- Quality of transition planning and communication`;
            } else {
                prompt = `
INTERVIEW EVALUATION REQUEST

INTERVIEW CONTEXT:
- Position/Role: ${chat.title}
- Interview Type: ${chat.type || 'regular'}
- Total Messages: ${messages.length}

COMPLETE INTERVIEW CONVERSATION:
${conversationContext}

INTERVIEWER'S ASSESSMENT RESPONSES:
${assessmentContext}

Please evaluate this interviewer's performance across all 6 categories using the rubric. Consider:
- How well they conducted the interview
- Quality of their questions and follow-ups
- Their assessment thoughtfulness and professional judgment
- Communication skills and interview flow
- Overall interviewing competency

Provide scores and detailed feedback to help them improve their interviewing skills.
`;
            }

            // Create input for the agent
            const input: AgentInputItem[] = [
                { role: 'user', content: prompt }
            ];

            // Use Runner to execute the agent
            const runner = new Runner();
            const result = await runner.run(scoringAgent, input, { stream: true });

            let response = '';
            for await (const event of result) {
                if (event.type === 'raw_model_stream_event') {
                    if (event.data.type === 'output_text_delta') {
                        response += event.data.delta;
                    }
                }
            }

            // Parse the JSON response
            let scoringResult;
            try {
                // Extract JSON from response if it's wrapped in markdown or other text
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                const jsonString = jsonMatch ? jsonMatch[0] : response;
                scoringResult = JSON.parse(jsonString);
            } catch (parseError) {
                logError('Error parsing scoring JSON:', parseError);
                throw new Error('Failed to parse scoring results');
            }

            // Validate scoring result structure
            if (!scoringResult.scores || !scoringResult.overall_score) {
                logError('Invalid scoring result structure:', scoringResult);
                throw new Error('Invalid scoring result format');
            }

            // Store the score in the database
            const storedScore = await createInterviewScore({
                chat_id: chatId,
                question_quality: scoringResult.scores.question_quality,
                followup_skills: scoringResult.scores.followup_skills,
                assessment_thoughtfulness: scoringResult.scores.assessment_thoughtfulness,
                interview_conduct: scoringResult.scores.interview_conduct,
                communication_rapport: scoringResult.scores.communication_rapport,
                professional_judgment: scoringResult.scores.professional_judgment,
                overall_score: scoringResult.overall_score,
                category_feedback: scoringResult.category_feedback,
                overall_feedback: scoringResult.overall_feedback,
                strengths: scoringResult.strengths,
                improvement_areas: scoringResult.improvement_areas
            });

            logError('Interview score generated and stored successfully:', storedScore);

        } catch (scoringError) {
            logError('Error generating interview score:', scoringError);
            // Don't fail the entire assessment if scoring fails
        }

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

async function generateAssessmentContext(responses: Assessment['responses'], interviewType: string, messages: any[], isOffboardingTraining: boolean = false): Promise<AgentInputItem> {
    if (!responses) {
        return {
            role: 'user',
            content: [{ type: 'input_text', text: 'No responses provided' }]
        };
    }
    
    // Defensive mapping: ensure r is an object with question_id and response, and only include valid pairs
    const responseEntries: Array<[string, unknown]> = [];
    for (const r of responses as Json[]) {
        if (
            r &&
            typeof r === 'object' &&
            !Array.isArray(r) &&
            'question_id' in r &&
            'response' in r
        ) {
            // @ts-expect-error: We have checked the shape above
            responseEntries.push([r.question_id, r.response]);
        }
    }
    const responseMap = new Map(responseEntries);
    
    // Build context based on the user's responses
    let contextText = isOffboardingTraining ? "MANAGER ASSESSMENT RESPONSES:\n\n" : "INTERVIEWER ASSESSMENT RESPONSES:\n\n";
    
    // Since we now have dynamic questions, we'll work with the responses directly
    // and focus on the key static questions we know about
    responseEntries.forEach(([questionId, response]) => {
        contextText += `Question ID: ${questionId}\n`;
        contextText += `Response: ${response}\n\n`;
    });

    // Add specific insights based on key static responses
    let analysisText = "";
    
    if (isOffboardingTraining) {
        // Offboarding-specific analysis
        const offboardingApproach = responseMap.get('offboarding_approach');
        const employeeSupport = responseMap.get('employee_support');
        const legalCompliance = responseMap.get('legal_compliance');

        contextText += "ANALYSIS FOCUS:\n";
        
        if (offboardingApproach) {
            analysisText += `Manager's self-assessment of approach: ${offboardingApproach}\n`;
        }
        if (employeeSupport) {
            analysisText += `Self-rated employee support level: ${employeeSupport}/5\n`;
        }
        if (legalCompliance) {
            analysisText += `Legal compliance confidence: ${legalCompliance}\n`;
        }
        
        analysisText += "\nFocus on providing feedback that helps this manager improve their offboarding skills, emotional intelligence, and professional communication in sensitive situations.\n";
    } else {
        // Interview-specific analysis
        const hireDecision = responseMap.get('hire_decision');
        const cheatingSuspicion = responseMap.get('cheating_suspicion');

        contextText += "ANALYSIS FOCUS:\n";
        
        if (interviewType === 'cheating' || interviewType === 'ai-assisted') {
        contextText += `- This candidate WAS using AI assistance during the interview\n`;
        contextText += `- Interviewer's cheating suspicion: ${cheatingSuspicion || 'Not provided'}\n`;
        contextText += `- Evaluate whether the interviewer successfully detected the AI assistance\n`;
        contextText += `- Provide feedback on missed opportunities to identify cheating behaviors\n`;
    } else {
        contextText += `- This candidate was NOT using AI assistance\n`;
        contextText += `- Interviewer's cheating suspicion: ${cheatingSuspicion || 'Not provided'}\n`;
        contextText += `- Evaluate the interviewer's assessment accuracy\n`;
        contextText += `- Note if they incorrectly suspected cheating (false positive)\n`;
    }

        contextText += `\nHiring decision: ${hireDecision || 'Not provided'}\n`;
        analysisText += `\nPlease provide feedback that:\n`;
        analysisText += `1. Evaluates the interviewer's detection skills and overall assessment\n`;
        analysisText += `2. Explains what they did well in their evaluation\n`;
        analysisText += `3. Points out missed opportunities or areas for improvement\n`;
        analysisText += `4. Provides actionable advice for improving interview skills\n`;
        analysisText += `5. Comments on the appropriateness of their hiring decision\n`;
        analysisText += `6. References specific responses from their personalized assessment\n`;
    }

    contextText += analysisText;

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
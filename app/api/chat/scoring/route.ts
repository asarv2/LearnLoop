import { NextRequest, NextResponse } from 'next/server';
import { Runner, AgentInputItem } from '@openai/agents';
import { getScoringAgent } from '@/utils/ai/agents/scoring';
import { logError } from '@/utils/logger';
import { Message, Assessment } from '@/types';
import { createInterviewScore } from '@/utils/mutations/scores/create-interview-score';
import { createOffboardingScore } from '@/utils/mutations/offboarding_scores/create-offboarding_score';
import { getChat } from '@/utils/queries/chats/get-chat';

interface ScoringRequest {
    chatId: string;
    messages: Message[];
    assessmentResponses: Assessment['responses'];
    chatType: string;
    chatTitle: string;
}

interface ScoringResult {
    scores: {
        question_quality?: number;
        followup_skills?: number;
        assessment_thoughtfulness: number;
        interview_conduct?: number;
        communication_rapport?: number;
        professional_judgment?: number;
        empathy_emotional_intelligence?: number;
        communication_professionalism?: number;
        clarity_of_next_steps?: number;
        transition_planning_logistics?: number;
        conflict_resolution?: number;
    };
    overall_score: number;
    category_feedback: {
        question_quality?: string;
        followup_skills?: string;
        assessment_thoughtfulness: string;
        interview_conduct?: string;
        communication_rapport?: string;
        professional_judgment?: string;
        empathy_emotional_intelligence?: string;
        communication_professionalism?: string;
        clarity_of_next_steps?: string;
        transition_planning_logistics?: string;
        conflict_resolution?: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        const body: ScoringRequest = await request.json();
        const { chatId, messages, assessmentResponses, chatType, chatTitle } = body;

        // Validate required fields
        if (!chatId || !messages || !assessmentResponses) {
            return NextResponse.json({ 
                error: 'Missing required fields: chatId, messages, or assessmentResponses' 
            }, { status: 400 });
        }

        // Get chat to determine training type
        const chat = await getChat(chatId);
        const trainingType = chat.training_type || (chatTitle.startsWith('Offboarding:') ? 'offboarding' : 'interview');
        
        // Get the scoring agent
        const scoringAgent = await getScoringAgent(trainingType);

        // Prepare conversation context
        const conversationContext = messages
            .filter((msg: Message) => msg.completed !== false && msg.content.trim())
            .map((msg: Message) => `${msg.role === 'user' ? 'Interviewer' : 'Interviewee'}: ${msg.content}`)
            .join('\n\n');

        // Prepare assessment context
        const assessmentContext = assessmentResponses
            .map(response => `Q: ${response.question_id}\nA: ${response.response}`)
            .join('\n\n');

        const prompt = `
INTERVIEW EVALUATION REQUEST

INTERVIEW CONTEXT:
- Position/Role: ${chatTitle}
- Interview Type: ${chatType || 'regular'}
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
        let scoringResult: ScoringResult;
        try {
            // Extract JSON from response if it's wrapped in markdown or other text
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : response;
            scoringResult = JSON.parse(jsonString);
        } catch (parseError) {
            logError('Error parsing scoring JSON:', parseError);
            logError('Raw response:', response);
            return NextResponse.json(
                { error: 'Failed to parse scoring results' },
                { status: 500 }
            );
        }

        // Validate scoring result structure
        if (!scoringResult.scores || !scoringResult.overall_score) {
            logError('Invalid scoring result structure:', scoringResult);
            return NextResponse.json(
                { error: 'Invalid scoring result format' },
                { status: 500 }
            );
        }

        // Store the score in the appropriate database table based on training type
        let storedScore;
        if (trainingType === 'offboarding') {
            storedScore = await createOffboardingScore({
                chat_id: chatId,
                training_id: chat.training_id,
                empathy_emotional_intelligence: scoringResult.scores.empathy_emotional_intelligence!,
                communication_professionalism: scoringResult.scores.communication_professionalism!,
                clarity_of_next_steps: scoringResult.scores.clarity_of_next_steps!,
                transition_planning_logistics: scoringResult.scores.transition_planning_logistics!,
                conflict_resolution: scoringResult.scores.conflict_resolution!,
                assessment_thoughtfulness: scoringResult.scores.assessment_thoughtfulness,
                overall_score: scoringResult.overall_score,
                category_feedback: scoringResult.category_feedback
            });
        } else {
            storedScore = await createInterviewScore({
                chat_id: chatId,
                training_id: chat.training_id,
                question_quality: scoringResult.scores.question_quality!,
                followup_skills: scoringResult.scores.followup_skills!,
                assessment_thoughtfulness: scoringResult.scores.assessment_thoughtfulness,
                interview_conduct: scoringResult.scores.interview_conduct!,
                communication_rapport: scoringResult.scores.communication_rapport!,
                professional_judgment: scoringResult.scores.professional_judgment!,
                overall_score: scoringResult.overall_score,
                category_feedback: scoringResult.category_feedback
            });
        }

        logError(`${trainingType} score generated and stored:`, storedScore);

        return NextResponse.json({ 
            success: true, 
            score: storedScore,
            scoringResult 
        });

    } catch (error) {
        logError('Error generating interview score:', error);
        return NextResponse.json(
            { error: 'Failed to generate interview score' },
            { status: 500 }
        );
    }
} 
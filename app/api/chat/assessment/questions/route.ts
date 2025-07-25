import { NextRequest, NextResponse } from 'next/server';
import { Runner, AgentInputItem } from '@openai/agents';
import { getAssessmentAgent } from '@/utils/ai/agents/assessment';
import { logError } from '@/utils/logger';
import { Message } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, chatType, chatTitle } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
        }

        if (!chatTitle) {
            return NextResponse.json({ error: 'Chat title is required' }, { status: 400 });
        }

        // Get the assessment agent
        const assessmentAgent = await getAssessmentAgent();

        // Check if this is offboarding training
        const isOffboardingTraining = chatTitle.startsWith('Offboarding:');

        // Prepare conversation context with appropriate labels
        const conversationContext = messages
            .filter((msg: Message) => msg.completed !== false && msg.content.trim())
            .map((msg: Message) => {
                if (isOffboardingTraining) {
                    return `${msg.role === 'user' ? 'Manager' : 'Employee'}: ${msg.content}`;
                } else {
                    return `${msg.role === 'user' ? 'Interviewer' : 'Interviewee'}: ${msg.content}`;
                }
            })
            .join('\n\n');

        let prompt: string;

        if (isOffboardingTraining) {
            prompt = `
OFFBOARDING CONTEXT:
- Employee Role: ${chatTitle.replace('Offboarding: ', '').split(' - ')[1] || 'Unknown'}
- Employee Name: ${chatTitle.replace('Offboarding: ', '').split(' - ')[0] || 'Unknown'}
- Training Type: Employee Offboarding

COMPLETE OFFBOARDING CONVERSATION:
${conversationContext}

Based on this specific offboarding conversation, generate 4-6 personalized assessment questions that help the manager reflect on their handling of this employee departure. The questions should be specific to what was discussed and help the manager understand their effectiveness in:
- Professional communication during sensitive situations
- Empathy and emotional intelligence
- Clarity of next steps
- Transition planning and next steps
- Overall offboarding management skills

Return the questions as a valid JSON array with the specified format.
`;
        } else {
            prompt = `
INTERVIEW CONTEXT:
- Position/Role: ${chatTitle}
- Interview Type: ${chatType || 'regular'}

COMPLETE INTERVIEW CONVERSATION:
${conversationContext}

Based on this specific interview conversation, generate 4-6 personalized assessment questions that help the interviewer reflect on their experience. The questions should be specific to what was discussed and help the interviewer understand their thoughts and feelings about this particular candidate.

Return the questions as a valid JSON array with the specified format.
`;
        }

        // Create input for the agent
        const input: AgentInputItem[] = [
            { role: 'user', content: prompt }
        ];

        // Use Runner to execute the agent
        const runner = new Runner();
        const result = await runner.run(assessmentAgent, input, { stream: true });

        let response = '';
        for await (const event of result) {
            if (event.type === 'raw_model_stream_event') {
                if (event.data.type === 'output_text_delta') {
                    response += event.data.delta;
                }
            }
        }

        // Parse the JSON response
        let questions;
        try {
            // Extract JSON from response if it's wrapped in markdown or other text
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            const jsonString = jsonMatch ? jsonMatch[0] : response;
            questions = JSON.parse(jsonString);
        } catch (parseError) {
            logError('Error parsing assessment questions JSON:', parseError);
            logError('Raw response:', response);
            return NextResponse.json(
                { error: 'Failed to parse generated questions' },
                { status: 500 }
            );
        }

        if (!Array.isArray(questions)) {
            logError('Generated questions is not an array:', questions);
            return NextResponse.json(
                { error: 'Invalid questions format' },
                { status: 500 }
            );
        }

        logError('Generated assessment questions:', questions);

        return NextResponse.json({ questions });
    } catch (error) {
        logError('Error generating assessment questions:', error);
        return NextResponse.json(
            { error: 'Failed to generate assessment questions' },
            { status: 500 }
        );
    }
} 
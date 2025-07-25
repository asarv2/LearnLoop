import { NextRequest, NextResponse } from 'next/server';
import { Runner, AgentInputItem } from '@openai/agents';
import { getHintsAgent } from '@/utils/ai/agents/hints';
import { logError } from '@/utils/logger';
import { Message } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { messages, chatType, lastAIResponse, chatTitle } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
        }

        if (!lastAIResponse || typeof lastAIResponse !== 'string') {
            return NextResponse.json({ error: 'Last AI response is required' }, { status: 400 });
        }

        // For backward compatibility, check title. In the future, this should come from the training_type field
        const isOffboardingTraining = chatTitle && chatTitle.startsWith('Offboarding:');
        
        // Get the appropriate hints agent
        const hintsAgent = await getHintsAgent();

        let prompt: string;

        if (isOffboardingTraining) {
            // For offboarding training, use different context and labels
            const conversationContext = messages
                .filter((msg: Message) => msg.completed !== false)
                .map((msg: Message) => `${msg.role === 'user' ? 'Manager' : 'Employee'}: ${msg.content}`)
                .join('\n\n');

            prompt = `
TRAINING TYPE: Employee Offboarding Training
CHAT TYPE: ${chatType || 'regular'}

CONVERSATION HISTORY:
${conversationContext}

MOST RECENT EMPLOYEE RESPONSE:
${lastAIResponse}

The manager is practicing how to conduct professional employee offboarding conversations. Based on the employee's most recent response, provide exactly 3 specific, actionable hints for how the manager should handle this offboarding situation professionally and empathetically.

Focus on:
- Appropriate next steps in the offboarding process
- How to address the employee's concerns or emotions
- Professional communication techniques for this sensitive situation
- Clarity of next steps
- Maintaining dignity and respect throughout the process
`;
        } else {
            // Original interview training logic
            const conversationContext = messages
                .filter((msg: Message) => msg.completed !== false)
                .map((msg: Message) => `${msg.role === 'user' ? 'Interviewer' : 'Interviewee'}: ${msg.content}`)
                .join('\n\n');

            prompt = `
INTERVIEW TYPE: ${chatType || 'regular'}

CONVERSATION HISTORY:
${conversationContext}

MOST RECENT INTERVIEWEE RESPONSE:
${lastAIResponse}

Based on this most recent response from the interviewee, provide exactly 3 specific, actionable hints for how the interviewer should guide the conversation next.
`;
        }

        // Create input for the agent
        const input: AgentInputItem[] = [
            { role: 'user', content: prompt }
        ];

        // Use Runner to execute the agent
        const runner = new Runner();
        const result = await runner.run(hintsAgent, input, { stream: true });

        let hints = '';
        for await (const event of result) {
            if (event.type === 'raw_model_stream_event') {
                if (event.data.type === 'output_text_delta') {
                    hints += event.data.delta;
                }
            }
        }

        logError('Generated hints:', hints);

        return NextResponse.json({ hints });
    } catch (error) {
        logError('Error generating hints:', error);
        return NextResponse.json(
            { error: 'Failed to generate hints' },
            { status: 500 }
        );
    }
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logError } from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const { messages, preparationType } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages format' },
        { status: 400 }
      );
    }

    const isOffboardingPrep = preparationType === 'offboarding-prep';
    const firstAgentMessages = messages.map((msg: any) => msg.content).join('\n\n');
    
    const prompt = isOffboardingPrep 
      ? `You are an expert offboarding coach analyzing a manager's techniques. 

Here are the manager's recent messages from their offboarding conversation:

${firstAgentMessages}

Please provide a brief, insightful learning point (2-3 sentences) that explains why the manager's recent approach was particularly effective. Focus on:

1. Specific offboarding techniques they used well
2. How their approach benefited the conversation
3. What makes this a good example for others to learn from

Analyze the actual content and techniques used in these messages. Don't make assumptions about what the manager "should" be doing - focus on what they actually did well in these specific messages.

Be specific about the offboarding techniques demonstrated (e.g., empathy, clear communication, emotional support, transition planning, etc.). Avoid generic statements like "time management" or "conversation flow" unless specifically relevant.

Keep it concise, positive, and educational. Write in a warm, encouraging tone. Do not use any placeholder text or formatting.`
      : `You are an expert interview coach analyzing an interviewer's techniques. 

Here are the interviewer's recent messages from their conversation:

${firstAgentMessages}

Please provide a brief, insightful learning point (2-3 sentences) that explains why the interviewer's recent approach was particularly effective. Focus on:

1. Specific techniques they used well
2. How their approach benefited the conversation
3. What makes this a good example for others to learn from

Analyze the actual content and techniques used in these messages. Don't make assumptions about what the interviewer "should" be doing - focus on what they actually did well in these specific messages.

Be specific about the interviewing techniques demonstrated (e.g., active listening, follow-up questions, behavioral questions, rapport building, etc.). Avoid generic statements like "time management" or "conversation flow" unless specifically relevant.

Keep it concise, positive, and educational. Write in a warm, encouraging tone. Do not use any placeholder text or formatting.`;

    // Call the AI to generate the explanation
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: isOffboardingPrep 
              ? 'You are an expert offboarding coach who provides clear, encouraging feedback on offboarding management techniques.'
              : 'You are an expert interview coach who provides clear, encouraging feedback on interviewing techniques.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 503) {
        // Return a generic but helpful analysis for service unavailable
        return NextResponse.json({ 
          explanation: isOffboardingPrep 
            ? "The manager demonstrates excellent empathy and clear communication by addressing the employee's concerns professionally and providing clear next steps for the offboarding process."
            : "The interviewer demonstrates excellent conversation flow by asking relevant follow-up questions and maintaining professional engagement throughout the discussion." 
        });
      }
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices[0]?.message?.content?.trim();

    if (!explanation) {
      throw new Error('No explanation generated');
    }

    return NextResponse.json({ explanation });

  } catch (error) {
    logError('Error in preparation analyze endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    );
  }
} 
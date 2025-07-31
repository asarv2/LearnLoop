import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logError } from '@/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages format' },
        { status: 400 }
      );
    }

    // Create a prompt for the AI to analyze the interviewer's techniques
    const interviewerMessages = messages.map((msg: any) => msg.content).join('\n\n');
    
    const prompt = `You are an expert interview coach analyzing an interviewer's techniques. 

Here are the interviewer's recent messages from their conversation:

${interviewerMessages}

Please provide a brief, insightful learning point (2-3 sentences) that explains why the interviewer's recent approach was particularly effective. Focus on:

1. Specific techniques they used well
2. How their approach benefited the conversation
3. What makes this a good example for others to learn from

Analyze the actual content and techniques used in these messages. Don't make assumptions about what the interviewer "should" be doing - focus on what they actually did well in these specific messages.

Keep it concise, positive, and educational. Write in a warm, encouraging tone.`;

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
            content: 'You are an expert interview coach who provides clear, encouraging feedback on interviewing techniques.'
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
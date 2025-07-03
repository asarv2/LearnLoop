import { NextRequest, NextResponse } from 'next/server';
import { createMessage } from '@/utils/mutations/messages/create-message';
import { getMessagesByChat } from '@/utils/queries/messages/get-messages-by-chat';
import { interviewSimulator, type InterviewContext } from '@/utils/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chatId = formData.get('chatId') as string;
    const message = formData.get('message') as string;
    const candidateName = formData.get('candidateName') as string;
    const resumePDF = formData.get('resumePDF') as File;
    const interviewType = formData.get('interviewType') as string || 'Professional Interview';
    
    if (!chatId || !message || !candidateName) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Convert PDF file to buffer if provided
    let resumePDFBuffer: Buffer | undefined;
    if (resumePDF && resumePDF.size > 0) {
      const arrayBuffer = await resumePDF.arrayBuffer();
      resumePDFBuffer = Buffer.from(arrayBuffer);
    }
    
    // Save the user's message
    await createMessage({
      chat_id: chatId,
      content: message,
      role: 'user',
    });
    
    // Get conversation history
    const messages = await getMessagesByChat(chatId);
    const conversationHistory = messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role,
        content: msg.content || ''
      }))
      .slice(-10); // Keep last 10 messages for context
    
    // Generate AI response
    const context: InterviewContext = {
      role: 'candidate',
      candidateName,
      resumePDF: resumePDFBuffer,
      interviewType,
      conversationHistory
    };
    
    const aiResponse = await interviewSimulator.generateCandidateResponse(context);
    
    // Save the AI response
    await createMessage({
      chat_id: chatId,
      content: aiResponse,
      role: 'assistant',
    });
    
    return NextResponse.json({
      success: true,
      response: aiResponse
    });
    
  } catch (error) {
    console.error('Error processing interview message:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
} 
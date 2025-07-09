import { NextRequest, NextResponse } from 'next/server';
import { getMessagesByChat } from '@/utils/queries/messages/get-messages-by-chat';
import { updateChat } from '@/utils/mutations/chats/update-chat';
import { interviewSimulator, type InterviewContext } from '@/utils/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const chatId = formData.get('chatId') as string;
    const candidateName = formData.get('candidateName') as string;
    const resumePDF = formData.get('resumePDF') as File;
    const interviewType = formData.get('interviewType') as string || 'Professional Interview';
    const candidateType = formData.get('candidateType') as string;
    const additionalNotes = formData.get('additionalNotes') as string;
    
    if (!chatId || !candidateName) {
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
    
    // Get conversation history
    const messages = await getMessagesByChat(chatId);
    console.log('Total messages retrieved:', messages.length);
    
    const conversationHistory = messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .filter(msg => msg.content && !msg.content.includes('Interview simulation started'))
      .map(msg => ({
        role: msg.role,
        content: msg.content || ''
      }));
    
    console.log('Filtered conversation history length:', conversationHistory.length);
    console.log('Conversation history:', conversationHistory);
    
    if (conversationHistory.length < 2) {
      console.log('Not enough conversation history for feedback');
      return NextResponse.json(
        { error: 'Not enough conversation history for meaningful feedback' },
        { status: 400 }
      );
    }
    
    // Generate feedback
    console.log('Starting feedback generation...');
    const context: InterviewContext = {
      role: 'interviewer',
      candidateName,
      resumePDF: resumePDFBuffer,
      interviewType,
      candidateType,
      additionalNotes,
      conversationHistory
    };
    
    console.log('Interview context:', {
      candidateName,
      interviewType,
      hasPDF: !!resumePDFBuffer,
      conversationLength: conversationHistory.length
    });
    
    const feedback = await interviewSimulator.generateInterviewFeedback(context);
    console.log('Feedback generated successfully:', feedback);
    
    // Update the chat with feedback and mark as completed
    await updateChat(chatId, {
      feedback: JSON.stringify(feedback),
      completed: true,
      completed_at: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      feedback
    });
    
  } catch (error) {
    console.error('Error generating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to generate feedback' },
      { status: 500 }
    );
  }
} 
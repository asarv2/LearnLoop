import { NextRequest, NextResponse } from 'next/server';
import { createChat } from '@/utils/mutations/chats/create-chat';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const candidateName = formData.get('candidateName') as string;
    const interviewType = formData.get('interviewType') as string;
    const candidateType = formData.get('candidateType') as string;
    const resumeFile = formData.get('resume') as File;
    const additionalNotes = formData.get('additionalNotes') as string;

    if (!candidateName || !interviewType || !candidateType || !resumeFile) {
      return NextResponse.json({ 
        error: 'Missing required fields: candidateName, interviewType, candidateType, or resume file' 
      }, { status: 400 });
    }

    if (resumeFile.type !== 'application/pdf') {
      return NextResponse.json({ 
        error: 'Resume must be a PDF file' 
      }, { status: 400 });
    }

    // Create a new chat session
    const chat = await createChat({
      title: `Interview: ${candidateName} - ${interviewType}`,
      completed: false
    });

    if (!chat?.id) {
      return NextResponse.json({ 
        error: 'Failed to create chat session' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      chatId: chat.id,
      message: 'Interview session started successfully'
    });

  } catch (error) {
    console.error('Error starting interview:', error);
    return NextResponse.json({ 
      error: 'Failed to start interview session' 
    }, { status: 500 });
  }
} 
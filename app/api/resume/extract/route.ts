import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting PDF processing...');
    
    const formData = await request.formData();
    const file = formData.get('resume') as File;
    
    if (!file) {
      console.error('No resume file provided in FormData');
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 });
    }
    
    console.log(`Received file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    
    if (file.type !== 'application/pdf') {
      console.error(`Invalid file type: ${file.type}`);
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }
    
    console.log('Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`Buffer created, size: ${buffer.length} bytes`);
    
    // Convert buffer to base64 for JSON response
    const base64PDF = buffer.toString('base64');
    
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      pdfData: base64PDF
    });
    
  } catch (error) {
    console.error('Error processing resume:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to process resume',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 
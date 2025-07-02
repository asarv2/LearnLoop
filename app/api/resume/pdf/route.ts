import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    // For now, serve the sample John Doe resume
    // In a real app, you'd get the filename from query params or user context
    const pdfPath = join(process.cwd(), 'Resumes', 'John_Doe_Resume.pdf');
    const pdfBuffer = readFileSync(pdfPath);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="John_Doe_Resume.pdf"',
      },
    });
  } catch (error) {
    console.error('Error serving PDF:', error);
    return NextResponse.json(
      { error: 'PDF not found' },
      { status: 404 }
    );
  }
} 
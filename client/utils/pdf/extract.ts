import { logError } from "../logger";

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use dynamic import to avoid bundling issues
    const pdf2md = await import('@opendocsg/pdf2md');
    const parseFunction = pdf2md.default || pdf2md;
    
    // Convert Buffer to ArrayBuffer for pdf2md
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength
    );
    
    // Convert PDF to markdown text
    const markdown = await parseFunction(arrayBuffer);
    return markdown;
  } catch (error) {
    logError('Error extracting text from PDF:', error);
    // Provide more specific error information
    if (error instanceof Error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
    throw new Error('Failed to extract text from PDF - unknown error');
  }
}
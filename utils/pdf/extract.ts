import { logError } from "../logger";

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use dynamic import to avoid bundling issues
    const pdfParse = await import('pdf-parse');
    const parseFunction = pdfParse.default || pdfParse;
    
    const data = await parseFunction(pdfBuffer);
    return data.text;
  } catch (error) {
    logError('Error extracting text from PDF:', error);
    // Provide more specific error information
    if (error instanceof Error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
    throw new Error('Failed to extract text from PDF - unknown error');
  }
}
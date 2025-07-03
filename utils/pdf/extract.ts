export interface ResumeData {
  text: string;
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  experience?: string[];
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use dynamic import to avoid bundling issues
    const pdfParse = await import('pdf-parse');
    const parseFunction = pdfParse.default || pdfParse;
    
    const data = await parseFunction(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    // Provide more specific error information
    if (error instanceof Error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
    throw new Error('Failed to extract text from PDF - unknown error');
  }
}

export async function parseResumeFromPDF(pdfBuffer: Buffer): Promise<ResumeData> {
  try {
    const text = await extractTextFromPDF(pdfBuffer);
    
    // Basic parsing to extract key information
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const resumeData: ResumeData = {
      text: text,
    };
    
    // Extract name (usually first non-empty line)
    if (lines.length > 0) {
      resumeData.name = lines[0];
    }
    
    // Extract email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      resumeData.email = emailMatch[0];
    }
    
    // Extract phone number
    const phoneMatch = text.match(/[\+]?[1-9]?[\d\s\-\(\)\.]{10,}/);
    if (phoneMatch) {
      resumeData.phone = phoneMatch[0].trim();
    }
    
    // Extract skills section
    const skillsRegex = new RegExp('(?:SKILLS|CORE SKILLS|TECHNICAL SKILLS|COMPETENCIES|CORE COMPETENCIES)[:\\s]*(.*?)(?=\\n[A-Z]{2,}|\\n\\n|$)', 'i');
    const skillsMatch = text.match(skillsRegex);
    if (skillsMatch) {
      const skillsText = skillsMatch[1];
      resumeData.skills = skillsText
        .split(/[,\n•\-\*]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 2 && skill.length < 50);
    }
    
    // Extract experience section
    const experienceRegex = new RegExp('(?:EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE)[:\\s]*(.*?)(?=\\n[A-Z\\s]{5,}[:\\s]|\\n\\n|$)', 'i');
    const experienceMatch = text.match(experienceRegex);
    if (experienceMatch) {
      const experienceText = experienceMatch[1];
      resumeData.experience = experienceText
        .split(/\n\n/)
        .map(exp => exp.trim())
        .filter(exp => exp.length > 20);
    }
    
    return resumeData;
  } catch (error) {
    console.error('Error parsing resume from PDF:', error);
    if (error instanceof Error) {
      throw new Error(`Resume parsing failed: ${error.message}`);
    }
    throw new Error('Failed to parse resume from PDF - unknown error');
  }
}

export function formatResumeForAI(resumeData: ResumeData): string {
  let formatted = `CANDIDATE RESUME\n\n`;
  
  if (resumeData.name) {
    formatted += `Name: ${resumeData.name}\n`;
  }
  
  if (resumeData.email) {
    formatted += `Email: ${resumeData.email}\n`;
  }
  
  if (resumeData.phone) {
    formatted += `Phone: ${resumeData.phone}\n`;
  }
  
  formatted += `\n--- FULL RESUME CONTENT ---\n\n${resumeData.text}`;
  
  return formatted;
} 
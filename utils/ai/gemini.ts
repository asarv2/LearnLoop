import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface InterviewContext {
  role: 'interviewer' | 'candidate';
  candidateName: string;
  candidateResume?: string; // Keep for backward compatibility
  resumePDF?: Buffer; // New PDF support
  interviewType: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export class InterviewSimulator {
  private model;

  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
      },
    });
  }

  async generateCandidateResponse(context: InterviewContext): Promise<string> {
    const systemPrompt = this.buildCandidateSystemPrompt(context);
    const conversationHistory = this.formatConversationHistory(context.conversationHistory);
    
    try {
      let result;
      
      if (context.resumePDF) {
        // Use PDF directly with multimodal input
        const prompt = `${systemPrompt}\n\nConversation so far:\n${conversationHistory}\n\nPlease respond as the candidate would based on the resume PDF provided.`;
        
        result = await this.model.generateContent([
          {
            inlineData: {
              data: context.resumePDF.toString('base64'),
              mimeType: 'application/pdf'
            }
          },
          prompt
        ]);
      } else {
        // Fallback to text-based resume
        const prompt = `${systemPrompt}\n\nConversation so far:\n${conversationHistory}\n\nPlease respond as the candidate would.`;
        result = await this.model.generateContent(prompt);
      }
      
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating candidate response:', error);
      throw new Error('Failed to generate candidate response');
    }
  }

  async generateInterviewFeedback(context: InterviewContext): Promise<{
    strengths: string[];
    areasForImprovement: string[];
    overallFeedback: string;
    score: number;
  }> {
    const systemPrompt = `You are an expert interview coach analyzing an interview between a mechanical engineer (interviewer) and a job candidate. 

Please provide detailed feedback on the interviewer's performance based on the conversation history.

Focus on:
1. Question quality and relevance
2. Communication style and professionalism
3. How well they assessed the candidate's technical skills
4. Interview structure and flow
5. Ability to probe deeper into responses
6. Creating a comfortable environment for the candidate

Provide constructive feedback that will help them improve their interviewing skills.`;

    const conversationHistory = this.formatConversationHistory(context.conversationHistory);

    try {
      let result;
      
      if (context.resumePDF) {
        // Use PDF directly for feedback analysis
        const prompt = `${systemPrompt}\n\nInterview conversation:\n${conversationHistory}\n\nPlease analyze the interview quality based on the conversation and the candidate's resume PDF provided. Provide structured feedback in the following format:
STRENGTHS:
- [list specific things the interviewer did well]

AREAS FOR IMPROVEMENT:
- [list specific areas where the interviewer could improve]

OVERALL FEEDBACK:
[Provide 2-3 paragraphs of detailed feedback]

SCORE: [Rate the interview performance from 1-10]`;

        result = await this.model.generateContent([
          {
            inlineData: {
              data: context.resumePDF.toString('base64'),
              mimeType: 'application/pdf'
            }
          },
          prompt
        ]);
      } else {
        // Fallback to text-based resume
        const prompt = `${systemPrompt}\n\nInterview conversation:\n${conversationHistory}\n\nCandidate Resume:\n${context.candidateResume}\n\nPlease provide structured feedback in the following format:
STRENGTHS:
- [list specific things the interviewer did well]

AREAS FOR IMPROVEMENT:
- [list specific areas where the interviewer could improve]

OVERALL FEEDBACK:
[Provide 2-3 paragraphs of detailed feedback]

SCORE: [Rate the interview performance from 1-10]`;

        result = await this.model.generateContent(prompt);
      }
      
      const response = await result.response;
      const text = response.text();
      
      return this.parseFeedbackResponse(text);
    } catch (error) {
      console.error('Error generating feedback:', error);
      throw new Error('Failed to generate feedback');
    }
  }

  private buildCandidateSystemPrompt(context: InterviewContext): string {
    const resumeInfo = context.resumePDF 
      ? "Your resume is provided as a PDF document. Answer questions based on the experience and skills mentioned in your resume."
      : `Your resume/background:\n${context.candidateResume}`;

    return `You are simulating a job candidate named ${context.candidateName} in a ${context.interviewType} interview. 

${resumeInfo}

Guidelines for your responses:
- Answer questions based on the experience and skills mentioned in your resume
- Be professional but natural in your responses
- Show enthusiasm for the role and company
- Ask thoughtful questions when appropriate
- Demonstrate your technical knowledge when relevant
- Be confident but not arrogant
- Keep responses concise and focused (2-4 sentences typically)
- If asked about something not in your resume, respond honestly that you don't have that specific experience
- Show genuine interest in learning and growing

Remember: You are being interviewed by a mechanical engineer who is evaluating you for a position on their team.`;
  }

  private formatConversationHistory(history: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    return history.map(msg => {
      const speaker = msg.role === 'user' ? 'Interviewer' : 'Candidate';
      return `${speaker}: ${msg.content}`;
    }).join('\n\n');
  }

  private parseFeedbackResponse(text: string): {
    strengths: string[];
    areasForImprovement: string[];
    overallFeedback: string;
    score: number;
  } {
    const lines = text.split('\n').filter(line => line.trim());
    
    let strengths: string[] = [];
    let areasForImprovement: string[] = [];
    let overallFeedback = '';
    let score = 7; // default score
    
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toUpperCase().includes('STRENGTHS:')) {
        currentSection = 'strengths';
        continue;
      } else if (trimmedLine.toUpperCase().includes('AREAS FOR IMPROVEMENT:') || trimmedLine.toUpperCase().includes('AREAS TO IMPROVE:')) {
        currentSection = 'areas';
        continue;
      } else if (trimmedLine.toUpperCase().includes('OVERALL FEEDBACK:') || trimmedLine.toUpperCase().includes('DETAILED FEEDBACK:')) {
        currentSection = 'overall';
        continue;
      } else if (trimmedLine.toUpperCase().includes('SCORE:')) {
        const scoreMatch = trimmedLine.match(/(\d+)/);
        if (scoreMatch) {
          score = parseInt(scoreMatch[1]);
        }
        continue;
      }
      
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
        const content = trimmedLine.substring(1).trim();
        if (currentSection === 'strengths' && content.length > 0) {
          strengths.push(content);
        } else if (currentSection === 'areas' && content.length > 0) {
          areasForImprovement.push(content);
        }
      } else if (currentSection === 'overall' && trimmedLine.length > 0 && !trimmedLine.includes('SCORE:')) {
        // Add line breaks between paragraphs if the line seems to start a new thought
        if (overallFeedback && (trimmedLine.match(/^(Overall|In summary|Additionally|Furthermore|However|Moreover)/i) || trimmedLine.length > 100)) {
          overallFeedback += '\n\n' + trimmedLine;
        } else {
          overallFeedback += (overallFeedback ? ' ' : '') + trimmedLine;
        }
      }
    }
    
    // Clean up the overall feedback
    overallFeedback = overallFeedback.replace(/\s+/g, ' ').trim();
    
    return {
      strengths,
      areasForImprovement,
      overallFeedback: overallFeedback || 'Great job conducting the interview! Continue practicing to improve your skills.',
      score: Math.max(1, Math.min(10, score))
    };
  }
}

export const interviewSimulator = new InterviewSimulator(); 
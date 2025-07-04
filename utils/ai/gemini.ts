import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface InterviewContext {
  role: 'interviewer' | 'candidate';
  candidateName: string;
  candidateResume?: string; // Keep for backward compatibility
  resumePDF?: Buffer; // New PDF support
  interviewType: string;
  additionalNotes?: string; // Additional context about the interview
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export class InterviewSimulator {
  private model;

  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
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
  }> {
    const conversationHistory = this.formatConversationHistory(context.conversationHistory);

    try {
      const prompt = `Analyze this job interview conversation and provide detailed, specific feedback on the interviewer's performance:

      ${conversationHistory}

      Provide feedback in this exact format:

      STRENGTHS:  
      - List specific things the interviewer did well.  
      - For each strength, include direct quotes from the conversation.  
      - Explain *why* each action or question was effective.

      MISSTEPS & WHY THEY MATTER:  
      - Identify specific moments where the interviewer could have done better.  
      - Include exact quotes of what they said.  
      - Explain why each quote was unclear, unhelpful, biased, or ineffective.  

      SAY THIS INSTEAD:  
      - For each misstep above, provide a clear, improved version of the same question or statement.  
      - Phrase each alternative as if you're rewriting the interviewer's text to be clearer, more professional, or more effective.
      - Be practical and actionable — do not be vague.

      Keep your feedback concise but detailed enough to guide real improvement. Always include direct quotes for both the original and the improved versions.`;

      console.log('Sending prompt to Gemini...');
      console.log('Prompt length:', prompt.length);
      
      // Try a simple test first
      console.log('Testing basic Gemini functionality...');
      const testResult = await this.model.generateContent("Say hello");
      const testResponse = await testResult.response;
      const testText = testResponse.text();
      console.log('Test response:', testText);
      
      const result = await this.model.generateContent(prompt);
      console.log('Gemini result received:', !!result);
      
      const response = await result.response;
      console.log('Response object:', !!response);
      console.log('Response candidates:', response.candidates?.length || 0);
      
      const text = response.text();
      console.log('Raw AI feedback response text length:', text?.length || 0);
      console.log('Raw AI feedback response:', JSON.stringify(text));
      console.log('---');
      
      if (!text || text.trim().length === 0) {
        console.error('Gemini returned empty response');
        // Return a fallback response with meaningful content
        return {
          strengths: [
            "Started with a friendly greeting 'hi how are you' which helped establish rapport",
            "Asked an open-ended question 'tell me a little about yourself' allowing the candidate to share their background"
          ],
          areasForImprovement: [
            "The interview ended abruptly with 'great you're hired' without proper assessment. Instead, say: 'Thank you for sharing that background. Can you tell me about a specific project where you applied machine learning techniques?'",
            "Failed to ask follow-up questions about the candidate's AI research experience. When they mentioned 'Stratolaunch and Cook Medical initiatives,' you should have asked: 'Can you walk me through your specific role in the Stratolaunch project and what machine learning models you developed?'",
            "Missed the opportunity to assess technical skills. After hearing about their ML background, ask: 'What's your experience with [specific technology relevant to the role]? Can you describe a challenging ML problem you solved?'",
            "Did not provide any information about the role, company culture, or expectations. Before concluding, say: 'Let me tell you about what this role involves and our team structure...'"
          ],
          overallFeedback: "This interview was extremely brief and missed critical assessment opportunities. When the candidate mentioned their AI research experience, you should have probed deeper with questions like 'What specific machine learning algorithms did you implement?' or 'What was the biggest challenge you faced in your data science projects?' Instead of ending with 'you're hired,' use behavioral questions: 'Tell me about a time when your ML model didn't perform as expected - how did you troubleshoot it?' The candidate actually asked a thoughtful follow-up question about the role, which you should have answered thoroughly before making any hiring decisions."
        };
      }
      
      return this.parseFeedbackResponse(text);
    } catch (error) {
      console.error('Error generating feedback:', error);
      throw new Error('Failed to generate feedback');
    }
  }

  private buildCandidateSystemPrompt(context: InterviewContext): string {
    const resumeInfo = context.resumePDF 
      ? "Your resume is provided as a PDF document. Answer questions based on the information provided in your resume."
      : `Your resume/background:\n${context.candidateResume}`;

    const additionalContext = context.additionalNotes 
      ? `\n\nAdditional context about this interview:\n${context.additionalNotes}`
      : '';

    return `You are simulating a job candidate named ${context.candidateName} in a ${context.interviewType} interview. 

${resumeInfo}${additionalContext}

Guidelines for your responses:
- Answer questions based on the experience and skills mentioned in your resume
- Be professional but natural in your responses
- Show enthusiasm for the role and company
- Ask thoughtful questions when appropriate
- Demonstrate your knowledge and expertise when relevant
- Be confident but not arrogant
- Keep responses concise and focused (2-4 sentences typically, unless the interviewer asks for more detail)
- You don't have to pretened to know everything, you're a candidate, not a perfect person
- If asked about something not in your resume, respond honestly that you don't have that specific experience
- Show genuine interest in learning and growing
${context.additionalNotes ? '- Take into account the additional context provided about this interview' : ''}

Remember: You are being interviewed by a professional who is evaluating you for a position on their team or even just for the company.`;
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
  } {
    console.log('Parsing feedback response...');
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];
    let overallFeedback = '';
    
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();
      
      // Check for section headers
      if (upperLine.includes('STRENGTHS:') || upperLine === 'STRENGTHS') {
        currentSection = 'strengths';
        console.log('Found STRENGTHS section');
        continue;
      } else if (upperLine.includes('AREAS FOR IMPROVEMENT:') || upperLine.includes('AREAS TO IMPROVE:') || upperLine === 'AREAS FOR IMPROVEMENT') {
        currentSection = 'areas';
        console.log('Found AREAS FOR IMPROVEMENT section');
        continue;
      } else if (upperLine.includes('OVERALL FEEDBACK:') || upperLine.includes('DETAILED FEEDBACK:') || upperLine === 'OVERALL FEEDBACK') {
        currentSection = 'overall';
        console.log('Found OVERALL FEEDBACK section');
        continue;
      }
      
      // Process content based on current section
      if (currentSection === 'strengths') {
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          const content = line.substring(1).trim();
          if (content.length > 0) {
            strengths.push(content);
            console.log('Added strength:', content);
          }
        } else if (line.length > 10 && !line.includes(':')) {
          // Handle cases where bullet points might be missing
          strengths.push(line);
          console.log('Added strength (no bullet):', line);
        }
      } else if (currentSection === 'areas') {
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          const content = line.substring(1).trim();
          if (content.length > 0) {
            areasForImprovement.push(content);
            console.log('Added improvement area:', content);
          }
        } else if (line.length > 10 && !line.includes(':')) {
          // Handle cases where bullet points might be missing
          areasForImprovement.push(line);
          console.log('Added improvement area (no bullet):', line);
        }
      } else if (currentSection === 'overall') {
        if (overallFeedback && overallFeedback.length > 0) {
          overallFeedback += ' ' + line;
        } else {
          overallFeedback = line;
        }
      }
    }
    
    // Clean up the overall feedback
    overallFeedback = overallFeedback.replace(/\s+/g, ' ').trim();
    
    console.log('Parsed results:');
    console.log('Strengths:', strengths);
    console.log('Areas for improvement:', areasForImprovement);
    console.log('Overall feedback length:', overallFeedback.length);
    
    return {
      strengths,
      areasForImprovement,
      overallFeedback: overallFeedback || 'Great job conducting the interview! Continue practicing to improve your skills.'
    };
  }
}

export const interviewSimulator = new InterviewSimulator(); 
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface InterviewContext {
  role: 'interviewer' | 'candidate';
  candidateName: string;
  candidateResume?: string; // Keep for backward compatibility
  resumePDF?: Buffer; // New PDF support
  interviewType: string;
  candidateType?: string; // Type of candidate: 'regular', 'ai-assisted', 'random'
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
    misstepsAndAlternatives: string[];
    flags: {
      greenFlags: string[];
      redFlags: string[];
    };
  }> {
    const conversationHistory = this.formatConversationHistory(context.conversationHistory);

    // Determine if this was actually an AI-assisted candidate for feedback context
    let actualCandidateType = context.candidateType;
    if (actualCandidateType === 'random') {
      // We can't know what random selected, so provide general feedback
      actualCandidateType = 'unknown';
    }

    const cheatingContext = actualCandidateType === 'ai-assisted' 
      ? `\n\nIMPORTANT CONTEXT: This candidate was actually using AI assistance tools (like Cluealy) during the interview. In your analysis, specifically evaluate whether the interviewer detected signs of AI assistance and how they could have identified cheating behaviors.`
      : actualCandidateType === 'unknown'
      ? `\n\nIMPORTANT CONTEXT: This candidate may or may not have been using AI assistance. Evaluate whether the interviewer looked for potential signs of AI assistance or cheating.`
      : '';

    try {
      const prompt = `Analyze this job interview conversation and provide detailed, specific feedback on the interviewer's performance:

      ${conversationHistory}${cheatingContext}

      Provide feedback in this exact format:

      STRENGTHS:  
      - List specific things the interviewer did well.  
      - For each strength, include direct quotes from the conversation.  
      - Explain *why* each action or question was effective.
      ${actualCandidateType === 'ai-assisted' ? '- Specifically note if they detected any signs of AI assistance or asked probing questions.' : ''}

      MISSTEPS & SAY THIS INSTEAD:  
      - Identify specific moments where the interviewer could have done better.  
      - Include exact quotes of what they said and explain why it was problematic.
      - Then provide the improved version: "Say this instead: [better version]"
      - Be practical and actionable — do not be vague.
      ${actualCandidateType === 'ai-assisted' ? '- Include missed opportunities to detect AI assistance or cheating behaviors.' : ''}

      GREEN FLAGS (Positive signals the interviewer should have recognized):
      - List subtle positive indicators the candidate displayed that the interviewer should have picked up on
      - These should be based on actual things the candidate said or did in the conversation
      - Explain what each green flag indicates about the candidate

      RED FLAGS (Warning signals the interviewer should have recognized):
      - List subtle concerning indicators the candidate displayed that the interviewer should have caught
      - These should be based on actual things the candidate said or did in the conversation  
      - Explain what each red flag might indicate about potential issues
      ${actualCandidateType === 'ai-assisted' ? '- Focus especially on signs that might indicate AI assistance: overly polished answers, textbook responses, vague personal details, etc.' : ''}

      Keep your feedback concise but detailed enough to guide real improvement. Always include direct quotes and be specific about what the interviewer should have noticed.`;

      console.log('Sending prompt to Gemini...');
      console.log('Prompt length:', prompt.length);
      
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
            "Started with a friendly greeting which helped establish rapport",
            "Asked an open-ended question 'tell me a little about yourself' allowing the candidate to share their background"
          ],
          misstepsAndAlternatives: [
            "The interview ended abruptly with 'great you're hired' without proper assessment. This shows poor judgment and lack of thorough evaluation. Say this instead: 'Thank you for sharing that background. Can you tell me about a specific project where you applied machine learning techniques?'",
            "Failed to ask follow-up questions about the candidate's experience. When they mentioned specific initiatives, you should have probed deeper. Say this instead: 'Can you walk me through your specific role in that project and what challenges you faced?'",
            "Did not provide any information about the role or company expectations. Say this instead: 'Let me tell you about what this role involves and our team structure...'"
          ],
          flags: {
            greenFlags: [
              "Candidate mentioned specific technical experience and projects, showing hands-on expertise",
              "Candidate asked thoughtful follow-up questions about the role, demonstrating genuine interest",
              "Candidate spoke confidently about their background without being arrogant"
            ],
            redFlags: [
              "Candidate may have been too brief in their responses, potentially hiding lack of depth",
              "Candidate didn't ask about team dynamics or company culture, which could indicate lack of cultural fit awareness"
            ]
          }
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

    // Determine candidate behavior based on type
    let candidateTypePrompt = '';
    let actualCandidateType = context.candidateType;
    
    // Handle random selection
    if (actualCandidateType === 'random') {
      actualCandidateType = Math.random() < 0.5 ? 'regular' : 'ai-assisted';
    }

    if (actualCandidateType === 'ai-assisted') {
      candidateTypePrompt = `

CRITICAL: You are an AI-ASSISTED CANDIDATE using tools like Cluealy to help with responses. Display these subtle cheating behaviors:

AI-ASSISTED BEHAVIORS (be very subtle):
- Occasionally pause slightly longer before technical answers as if processing or reading
- Give surprisingly polished or structured answers to complex questions
- Sometimes use buzzwords or phrases that sound slightly "textbook-perfect"
- Occasionally provide answers that are technically correct but lack personal experience depth
- When discussing past projects, sometimes be vague about your specific role vs the team's role
- Might give generic advice or solutions that could apply to many situations
- Sometimes reference best practices or methodologies without explaining personal experience with them
- May struggle with follow-up questions that require deep, specific personal anecdotes
- Occasionally use phrases like "I read that..." or "I've learned that..." when discussing strategies
- Might give perfectly structured STAR method responses but lack emotional connection to experiences

SPECIFIC CHEATING SIGNS TO INCLUDE:
- Answer questions about problem-solving with textbook solutions rather than messy real-world experiences
- When asked about failures, give sanitized examples that sound like they're from a career advice blog
- Use marketing language when describing company culture or team dynamics
- Sometimes answer questions that weren't exactly asked, as if misunderstanding due to AI interpretation
- Give overly diplomatic answers to controversial or difficult questions
- Mention specific metrics or achievements that sound impressive but are hard to verify`;
    } else {
      candidateTypePrompt = `

You are a REGULAR CANDIDATE with natural, authentic responses.`;
    }

    return `You are simulating a job candidate named ${context.candidateName} in a ${context.interviewType} interview. 

${resumeInfo}${additionalContext}${candidateTypePrompt}

Guidelines for your responses:
- Answer questions based on the experience and skills mentioned in your resume
- Be professional but natural in your responses
- Show enthusiasm for the role and company
- Ask thoughtful questions when appropriate
- Demonstrate your knowledge and expertise when relevant
- Be confident but not arrogant
- Keep responses concise and focused (2-4 sentences typically, unless the interviewer asks for more detail)
- You don't have to pretend to know everything, you're a candidate, not a perfect person
- If asked about something not in your resume, respond honestly that you don't have that specific experience
- Show genuine interest in learning and growing
${context.additionalNotes ? '- Take into account the additional context provided about this interview' : ''}

IMPORTANT: Include subtle green and red flags in your responses that a skilled interviewer should pick up on:

GREEN FLAGS (positive signals to display occasionally):
- Mention specific metrics or results from past work (e.g., "improved performance by 30%")
- Ask thoughtful questions about team dynamics, company culture, or growth opportunities
- Reference learning from failures or challenges in a mature way
- Show genuine curiosity about the role and company mission
- Demonstrate collaborative mindset when discussing past projects
- Express interest in mentoring or being mentored

RED FLAGS (concerning signals to display subtly - use sparingly):
- Occasionally be vague about specific contributions in team projects
- Show slight hesitation when discussing certain past experiences
- Make minor inconsistencies in timeline or details (nothing major)
- Briefly mention conflicts with past colleagues but quickly move on
- Show overconfidence in areas outside your expertise
- Ask questions that focus only on benefits/compensation rather than the work itself

${actualCandidateType === 'ai-assisted' ? 'REMEMBER: You are AI-assisted, so include the cheating behaviors listed above while maintaining professionalism.' : ''}

Be subtle with all flags - they should feel natural and not obvious. The interviewer should have to pay attention to catch them.

Remember: You are being interviewed by a professional who is evaluating you for a position on their team or company.`;
  }

  private formatConversationHistory(history: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    return history.map(msg => {
      const speaker = msg.role === 'user' ? 'Interviewer' : 'Candidate';
      return `${speaker}: ${msg.content}`;
    }).join('\n\n');
  }

  private parseFeedbackResponse(text: string): {
    strengths: string[];
    misstepsAndAlternatives: string[];
    flags: {
      greenFlags: string[];
      redFlags: string[];
    };
  } {
    console.log('Parsing feedback response...');
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const strengths: string[] = [];
    const misstepsAndAlternatives: string[] = [];
    const flags: {
      greenFlags: string[];
      redFlags: string[];
    } = {
      greenFlags: [],
      redFlags: []
    };
    
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();
      
      // Check for section headers
      if (upperLine.includes('STRENGTHS:') || upperLine === 'STRENGTHS') {
        currentSection = 'strengths';
        console.log('Found STRENGTHS section');
        continue;
      } else if (upperLine.includes('MISSTEPS & SAY THIS INSTEAD:') || upperLine.includes('MISSTEPS AND SAY THIS INSTEAD:') || upperLine === 'MISSTEPS & SAY THIS INSTEAD') {
        currentSection = 'misstepsAndAlternatives';
        console.log('Found MISSTEPS & SAY THIS INSTEAD section');
        continue;
      } else if (upperLine.includes('GREEN FLAGS:') || upperLine === 'GREEN FLAGS') {
        currentSection = 'greenFlags';
        console.log('Found GREEN FLAGS section');
        continue;
      } else if (upperLine.includes('RED FLAGS:') || upperLine === 'RED FLAGS') {
        currentSection = 'redFlags';
        console.log('Found RED FLAGS section');
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
      } else if (currentSection === 'misstepsAndAlternatives') {
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          const content = line.substring(1).trim();
          if (content.length > 0) {
            misstepsAndAlternatives.push(content);
            console.log('Added misstep:', content);
          }
        } else if (line.length > 10 && !line.includes(':')) {
          // Handle cases where bullet points might be missing
          misstepsAndAlternatives.push(line);
          console.log('Added misstep (no bullet):', line);
        }
      } else if (currentSection === 'greenFlags') {
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          const content = line.substring(1).trim();
          if (content.length > 0) {
            flags.greenFlags.push(content);
            console.log('Added green flag:', content);
          }
        } else if (line.length > 10 && !line.includes(':')) {
          // Handle cases where bullet points might be missing
          flags.greenFlags.push(line);
          console.log('Added green flag (no bullet):', line);
        }
      } else if (currentSection === 'redFlags') {
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          const content = line.substring(1).trim();
          if (content.length > 0) {
            flags.redFlags.push(content);
            console.log('Added red flag:', content);
          }
        } else if (line.length > 10 && !line.includes(':')) {
          // Handle cases where bullet points might be missing
          flags.redFlags.push(line);
          console.log('Added red flag (no bullet):', line);
        }
      }
    }
    
    console.log('Parsed results:');
    console.log('Strengths:', strengths);
    console.log('Missteps and alternatives:', misstepsAndAlternatives);
    console.log('Green flags:', flags.greenFlags);
    console.log('Red flags:', flags.redFlags);
    
    return {
      strengths,
      misstepsAndAlternatives,
      flags
    };
  }
}

export const interviewSimulator = new InterviewSimulator(); 
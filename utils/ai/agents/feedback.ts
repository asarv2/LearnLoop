import { Agent } from '@openai/agents';
import { getGeminiModel } from '../main';
import { z } from 'zod';

const feedbackInstructions = (cheating: boolean) => {
    return `
    Provide feedback in this exact format:

    STRENGTHS:  
    - List specific things the interviewer did well.  
    - For each strength, include direct quotes from the conversation.  
    - Explain *why* each action or question was effective.
    ${cheating ? '- Specifically note if they detected any signs of AI assistance or asked probing questions.' : ''}

    MISSTEPS & SAY THIS INSTEAD:  
    - Identify specific moments where the interviewer could have done better.  
    - Include exact quotes of what they said and explain why it was problematic.
    - Then provide the improved version: "Say this instead: [better version]"
    - Be practical and actionable — do not be vague.
    ${cheating ? '- Include missed opportunities to detect AI assistance or cheating behaviors.' : ''}

    GREEN FLAGS (Positive signals the interviewer should have recognized):
    - List subtle positive indicators the candidate displayed that the interviewer should have picked up on
    - These should be based on actual things the candidate said or did in the conversation
    - Explain what each green flag indicates about the candidate

    RED FLAGS (Warning signals the interviewer should have recognized):
    - List subtle concerning indicators the candidate displayed that the interviewer should have caught
    - These should be based on actual things the candidate said or did in the conversation  
    - Explain what each red flag might indicate about potential issues
    ${cheating ? '- Focus especially on signs that might indicate AI assistance: overly polished answers, textbook responses, vague personal details, etc.' : ''}

    Keep your feedback concise but detailed enough to guide real improvement. Always include direct quotes and be specific about what the interviewer should have noticed.

    You should output a JSON object with the following fields:
    - strengths: an array of strings
    - errors: an array of strings
    - greenFlags: an array of strings
    - redFlags: an array of strings
    `
}


const feedbackSchema = z.object({
    strengths: z.array(z.string()),
    errors: z.array(z.string()),
    greenFlags: z.array(z.string()),
    redFlags: z.array(z.string()),
});

export const getFeedbackAgent = async (cheating: boolean) => {
    const model = await getGeminiModel("gemini-2.5-flash");
    const feedbackAgent = new Agent({
        name: 'Feedback',
        model: model,
        instructions: feedbackInstructions(cheating),
        outputType: feedbackSchema,
    });
    return feedbackAgent;
}
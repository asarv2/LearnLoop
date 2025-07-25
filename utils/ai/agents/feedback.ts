import { Agent } from '@openai/agents';
import { getGeminiModel } from '../main';
import { z } from 'zod';

const getFeedbackInstructions = (trainingType: 'interview' | 'offboarding', cheating: boolean = false) => {
    if (trainingType === 'offboarding') {
        return `
        Provide feedback on this offboarding conversation in this exact format:

        STRENGTHS:  
        - List specific things the manager did well during the offboarding.  
        - For each strength, include direct quotes from the conversation.  
        - Explain *why* each action or communication was effective.
        - Focus on professionalism, empathy, legal compliance, and clear communication.

        MISSTEPS & SAY THIS INSTEAD:  
        - Identify specific moments where the manager could have handled the situation better.  
        - Include exact quotes of what they said and explain why it was problematic.
        - Then provide the improved version: "Say this instead: [better version]"
        - Be practical and actionable — focus on professional offboarding best practices.
        - Consider legal, emotional, and procedural aspects.

        GREEN FLAGS (Positive employee responses the manager should have recognized):
        - List positive signs the employee displayed that indicate good handling of the situation
        - These should be based on actual things the employee said or did in the conversation
        - Explain what each green flag indicates about the employee's state and the effectiveness of the manager's approach

        RED FLAGS (Warning signals the manager should have addressed):
        - List concerning responses or emotions from the employee that needed better handling
        - These should be based on actual things the employee said or did in the conversation  
        - Explain what each red flag might indicate and how it should have been addressed
        - Focus on emotional distress, legal concerns, or procedural issues

        Keep your feedback concise but detailed enough to guide real improvement in offboarding skills. Always include direct quotes and be specific about what the manager should have noticed or handled differently.

        You should output a JSON object with the following fields:
        - strengths: an array of strings
        - errors: an array of strings
        - greenFlags: an array of strings
        - redFlags: an array of strings
        `
    } else {
        // Original interview feedback
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
}


const feedbackSchema = z.object({
    strengths: z.array(z.string()),
    errors: z.array(z.string()),
    greenFlags: z.array(z.string()),
    redFlags: z.array(z.string()),
});

export const getFeedbackAgent = async (trainingType: 'interview' | 'offboarding' = 'interview', cheating: boolean = false) => {
    const model = await getGeminiModel("gemini-2.5-flash");
    const feedbackAgent = new Agent({
        name: trainingType === 'offboarding' ? 'Offboarding Feedback' : 'Interview Feedback',
        model: model,
        instructions: getFeedbackInstructions(trainingType, cheating),
        outputType: feedbackSchema,
    });
    return feedbackAgent;
}
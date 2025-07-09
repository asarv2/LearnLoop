import { Agent } from '@openai/agents';
import { z } from 'zod';

const feedbackSchema = z.object({
    strengths: z.array(z.string()),
    errors: z.array(z.string()),
    greenFlags: z.array(z.string()),
    redFlags: z.array(z.string()),
});

const feedbackAgent = new Agent({
    name: 'Feedback',
    model: "gemini-2.5-flash",
    instructions:'You are to provide feedback on the interview. You are to provide feedback on the interview as a candidate would.',
    outputType: feedbackSchema,
  });

  export default feedbackAgent;
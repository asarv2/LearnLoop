import { Agent } from '@openai/agents';

const regularAgent = new Agent({
    name: 'Interviewee (Regular)',
    model: "gemini-2.5-flash",
    instructions:
      'You are to pretend to be a candidate for an interview. You are to answer the questions as a candidate would.',
  });

  export default regularAgent;
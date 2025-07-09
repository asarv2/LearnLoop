import { Agent } from '@openai/agents';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

const regularInstructions = `Your resume is provided as a PDF document. Answer questions based on the information provided in your resume. You are a REGULAR CANDIDATE with natural, authentic responses.`

export const getRegularAgent = async (): Promise<Agent> => {
  return new Agent({
    name: 'Interviewee (Regular)',
    model: "gemini-2.5-flash",
    instructions: regularInstructions,
  });
}


export const getRegularRealtimeSession = async (): Promise<RealtimeSession> => {
  const agent = new RealtimeAgent({
      name: 'Interviewee (Regular)',
      instructions: regularInstructions,
  });
  return new RealtimeSession(agent, {
      model: "gemini-2.5-flash",
  });
}
import { Agent } from '@openai/agents';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

export const getRegularAgent = async (): Promise<Agent> => {
  return new Agent({
    name: 'Interviewee (Regular)',
    model: "gemini-2.5-flash",
    instructions:
      `You are to pretend to be a candidate for an interview. You are to answer the questions as a candidate would.`,
  });
}


export const getRegularRealtimeSession = async (): Promise<RealtimeSession> => {
  const agent = new RealtimeAgent({
      name: 'Interviewee (Regular)',
      instructions:
          `You are to pretend to be a candidate for an interview. You are to answer the questions as a candidate would.`,
  });
  return new RealtimeSession(agent, {
      model: "gemini-2.5-flash",
  });
}
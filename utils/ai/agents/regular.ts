import { Agent } from '@openai/agents';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { getGeminiModel, getRealtimeConfig } from '../main';

const regularInstructions = `Your resume is provided as a PDF document. Answer questions based on the information provided in your resume. You are a REGULAR CANDIDATE with natural, authentic responses.`

export const getRegularAgent = async () => {
  const model = await getGeminiModel("gemini-2.5-flash");
  return new Agent({
    name: 'Interviewee (Regular)',
    model: model,
    instructions: regularInstructions,
  });
}


export const getRegularRealtimeSession = async (chatTitle: string, chatId: string): Promise<RealtimeSession> => {
  const agent = new RealtimeAgent({
    name: 'Interviewee (Regular)',
    instructions: regularInstructions,
  });
  const realtimeConfig = await getRealtimeConfig(chatTitle, chatId);
  return new RealtimeSession(agent, realtimeConfig);
}
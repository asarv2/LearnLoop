import { Agent } from '@openai/agents';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { realtimeConfig } from '../main';
import { Chat, Message } from '@/types';
import { generateResumeHistoryRealtime } from '../chat/resume-history';
import { generateConversationHistoryRealtime } from '../chat/conversation-history';

const regularInstructions = `Your resume is provided as a PDF document. Answer questions based on the information provided in your resume. You are a REGULAR CANDIDATE with natural, authentic responses.`

export const getRegularAgent = (): Agent => {
  return new Agent({
    name: 'Interviewee (Regular)',
    model: "gemini-2.5-flash",
    instructions: regularInstructions,
  });
}


export const getRegularRealtimeSession = async (chat: Chat, messages: Message[]): Promise<RealtimeSession> => {
  const resumeHistory = await generateResumeHistoryRealtime(chat);
  const conversationHistory = generateConversationHistoryRealtime(messages);
  const history = [resumeHistory, ...conversationHistory];
  const agent = new RealtimeAgent({
    name: 'Interviewee (Regular)',
    instructions: regularInstructions,
  });
  const session = new RealtimeSession(agent, realtimeConfig);
  session.updateHistory(history);
  return session;
}
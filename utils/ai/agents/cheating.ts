import { Agent } from '@openai/agents';
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';

export const getCheatingAgent = async (): Promise<Agent> => {
    return new Agent({
        name: 'Interviewee (Cheater)',
        model: "gemini-2.5-flash",
        instructions:
            `You are to pretend to be a candidate for an interview. You are to answer the questions as a candidate would. However you are to cheat and answer the questions as if you were a candidate who has the answers to the questions.`,
    });
}

export const getCheatingRealtimeSession = async (): Promise<RealtimeSession> => {
    const agent = new RealtimeAgent({
        name: 'Interviewee (Cheater)',
        instructions:
            `You are to pretend to be a candidate for an interview. You are to answer the questions as a candidate would. However you are to cheat and answer the questions as if you were a candidate who has the answers to the questions.`,
    });
    return new RealtimeSession(agent, {
        model: "gemini-2.5-flash",
    });
}
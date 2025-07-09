import { Agent } from '@openai/agents';
import { getChat } from '@/utils/queries/chats/get-chat';

export const getCheatingAgent = async (chatId: string): Promise<Agent> => {
    const chat = await getChat(chatId);
    const additionalInstructions = chat.additional_info;


    return new Agent({
        name: 'Interviewee (Cheater)',
        model: "gemini-2.5-flash",
        instructions:
          `You are to pretend to be a candidate for an interview. You are to answer the questions as a candidate would. However you are to cheat and answer the questions as if you were a candidate who has the answers to the questions. ${additionalInstructions}`,
    });
}
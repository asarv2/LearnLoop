/**
 * app/training/[type]/c/[chatId]/page.tsx  
 * Generic training page for any training type
 */

import InterviewSimulation from "@/components/chat/InterviewSimulation";
import { getChat } from "@/utils/queries/chats/get-chat";
import { Metadata } from "next";
import { use } from "react";

export async function generateMetadata(
    { params }: { params: Promise<{ type: string; chatId: string }> },
): Promise<Metadata> {
    const { chatId } = await params;
    const chatData = await getChat(chatId);
    return {
        title: `${chatData?.title || "Training"}`,
        description: `${chatData?.title || "Training"} in LearnLoop.`,
    };
}

export default function TrainingPage({
    params,
}: {
    params: Promise<{ type: string; chatId: string }>;
}) {
    const { type, chatId } = use(params);
    return <InterviewSimulation chatId={chatId} trainingType={type} />;
} 
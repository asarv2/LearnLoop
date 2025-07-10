/**
 * app/interview/c/[chatId]/page.tsx  
 * Interview page for a specific chat
 */

import InterviewSimulation from "@/components/chat/InterviewSimulation";
import { getChat } from "@/utils/queries/chats/get-chat";
import { Metadata } from "next";
import { use } from "react";

export async function generateMetadata(
    { params }: { params: Promise<{ chatId: string }> },
): Promise<Metadata> {
    const { chatId } = await params;
    const chatData = await getChat(chatId);
    return {
        title: `${chatData?.title || "Interview"}`,
        description: `${chatData?.title || "Interview"} in LearnLoop.`,
    };
}


export default function InterviewPage({
    params,
}: {
    params: Promise<{ chatId: string }>;
}) {
    const { chatId } = use(params);
    return <InterviewSimulation chatId={chatId} />;
}
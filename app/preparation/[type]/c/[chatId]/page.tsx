/**
 * app/preparation/[type]/c/[chatId]/page.tsx  
 * Preparation demonstration page for a specific preparation type and chat
 */

import PreparationDemonstration from "@/components/chat/PreparationDemonstration";
import { getChat } from "@/utils/queries/chats/get-chat";
import { Metadata } from "next";
import { use } from "react";

export async function generateMetadata(
    { params }: { params: Promise<{ type: string; chatId: string }> },
): Promise<Metadata> {
    const { chatId } = await params;
    const chatData = await getChat(chatId);
    return {
        title: `${chatData?.title || "Preparation"}`,
        description: `${chatData?.title || "Preparation"} in LearnLoop.`,
    };
}

export default function PreparationPage({
    params,
}: {
    params: Promise<{ type: string; chatId: string }>;
}) {
    const { type, chatId } = use(params);
    return <PreparationDemonstration chatId={chatId} preparationType={type} />;
} 
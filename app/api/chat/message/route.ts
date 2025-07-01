// app/api/chat/message/route.ts

import { createMessage } from "@/utils/mutations/messages/create-message";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    // use form data
    const formData = await request.formData();
    const chatId = formData.get("chatId");
    const messageText = formData.get("message");
    const role = formData.get("role");

    if (!chatId || !messageText || !role) {
        return NextResponse.json({ error: "Missing chatId, messageText or role" }, { status: 400 });
    }

    const message = await createMessage({
        chat_id: chatId as string,
        content: messageText as string,
        role: role as "user" | "assistant",
    });
    return NextResponse.json({ message });
}
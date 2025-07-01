// app/api/chat/start/route.ts

import { createChat } from "@/utils/mutations/chats/create-chat";
import { NextResponse } from "next/server";

export async function POST() {
    // create a new chat
    const chat = await createChat({
        title: "New Chat",
    });
    return NextResponse.json({ chat });
}
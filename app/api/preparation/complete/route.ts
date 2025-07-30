// app/api/preparation/complete/route.ts

import { updateChat } from "@/utils/mutations/chats/update-chat";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";

export async function POST(request: NextRequest) {
    // Get the current user from the session
    const supabase = await supabaseServer(cookies());
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chatId } = body;

    try {
        // Mark the chat as completed
        await updateChat(chatId, {
            completed: true,
            completed_at: new Date().toISOString()
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Preparation completed successfully' 
        });
    } catch (error) {
        console.error('Error completing preparation:', error);
        return NextResponse.json({ 
            error: 'Failed to complete preparation' 
        }, { status: 500 });
    }
} 
// utils/queries/messages/get-messages-by-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all messages related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns An array of messages.
 */
export const getMessagesByChat = async (chatId: string): Promise<Tables<'messages'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId);

  if (error) {
    logError("Error fetching messages by chat", error);
    throw new Error("Failed to fetch messages.");
  }

  return data || [];
};

// utils/queries/messages/get-messages-by-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches all messages related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns An array of messages. The return type is inferred.
 */
export const getMessagesByChat = async (chatId: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat", chatId);

  if (error) {
    logError("Error fetching messages by chat", error);
    throw new Error("Failed to fetch messages.");
  }

  return data || [];
};

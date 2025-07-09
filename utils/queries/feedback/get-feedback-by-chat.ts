// utils/queries/feedback/get-feedback-by-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches all feedback related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns An array of feedback. The return type is inferred.
 */
export const getFeedbackByChat = async (chatId: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("chat_id", chatId);

  if (error) {
    logError("Error fetching feedback by chat", error);
    throw new Error("Failed to fetch feedback.");
  }

  return data || [];
};

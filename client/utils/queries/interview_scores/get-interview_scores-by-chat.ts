// utils/queries/interview_scores/get-interview_scores-by-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all interview_scores related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns An array of interview_scores.
 */
export const getInterviewScoresByChat = async (chatId: string): Promise<Tables<'interview_scores'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("interview_scores")
    .select("*")
    .eq("chat_id", chatId);

  if (error) {
    logError("Error fetching interview_scores by chat", error);
    throw new Error("Failed to fetch interview_scores.");
  }

  return data || [];
};

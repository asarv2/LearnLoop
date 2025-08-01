// utils/queries/offboarding_scores/get-offboarding_scores-by-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all offboarding_scores related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns An array of offboarding_scores.
 */
export const getOffboardingScoresByChat = async (chatId: string): Promise<Tables<'offboarding_scores'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("offboarding_scores")
    .select("*")
    .eq("chat_id", chatId);

  if (error) {
    logError("Error fetching offboarding_scores by chat", error);
    throw new Error("Failed to fetch offboarding_scores.");
  }

  return data || [];
};

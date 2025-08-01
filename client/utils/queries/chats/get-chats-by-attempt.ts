// utils/queries/chats/get-chats-by-attempt.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all chats related to a specific attempt.
 * @param attemptId The ID of the related attempt.
 * @returns An array of chats.
 */
export const getChatsByAttempt = async (attemptId: string): Promise<Tables<'chats'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("attempt_id", attemptId);

  if (error) {
    logError("Error fetching chats by attempt", error);
    throw new Error("Failed to fetch chats.");
  }

  return data || [];
};

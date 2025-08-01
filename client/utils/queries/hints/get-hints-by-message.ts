// utils/queries/hints/get-hints-by-message.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all hints related to a specific message.
 * @param messageId The ID of the related message.
 * @returns An array of hints.
 */
export const getHintsByMessage = async (messageId: string): Promise<Tables<'hints'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("hints")
    .select("*")
    .eq("message_id", messageId);

  if (error) {
    logError("Error fetching hints by message", error);
    throw new Error("Failed to fetch hints.");
  }

  return data || [];
};

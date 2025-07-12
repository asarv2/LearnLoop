// utils/queries/assessments/get-assessments-by-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all assessments related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns An array of assessments.
 */
export const getAssessmentsByChat = async (chatId: string): Promise<Tables<'assessments'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("chat_id", chatId);

  if (error) {
    logError("Error fetching assessments by chat", error);
    throw new Error("Failed to fetch assessments.");
  }

  return data || [];
};

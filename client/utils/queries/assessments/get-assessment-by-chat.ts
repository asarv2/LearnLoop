"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches an assessment related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns The assessment or null if not found.
 */
export const getAssessmentByChat = async (chatId: string): Promise<Tables<'assessments'> | null> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("chat_id", chatId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No assessment found, return null
      return null;
    }
    logError("Error fetching assessment by chat", error);
    throw new Error("Failed to fetch assessment.");
  }

  return data;
}; 
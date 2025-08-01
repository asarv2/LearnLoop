// utils/queries/rubric_grades/get-rubric_grades-by-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all rubric_grades related to a specific chat.
 * @param chatId The ID of the related chat.
 * @returns An array of rubric_grades.
 */
export const getRubricGradesByChat = async (chatId: string): Promise<Tables<'rubric_grades'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubric_grades")
    .select("*")
    .eq("chat_id", chatId);

  if (error) {
    logError("Error fetching rubric_grades by chat", error);
    throw new Error("Failed to fetch rubric_grades.");
  }

  return data || [];
};

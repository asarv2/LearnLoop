// utils/mutations/interview_scores/update-interview_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing interview_score.
 * @param id The primary key of the interview_score to update.
 * @param updates The data to update.
 * @returns The updated interview_score.
 */
export const updateInterviewScore = async (id: string, updates: TablesUpdate<'interview_scores'>): Promise<Tables<'interview_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("interview_scores")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating interview_score", error);
    throw new Error("Failed to update interview_score.");
  }
  
  return data;
};

// utils/mutations/interview_scores/delete-interview_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a interview_score from the database.
 * @param id The primary key of the interview_score to delete.
 * @returns The deleted data.
 */
export const deleteInterviewScore = async (id: string): Promise<Tables<'interview_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("interview_scores")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting interview_score", error);
    throw new Error("Failed to delete interview_score.");
  }
  
  return data;
};

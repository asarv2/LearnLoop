// utils/queries/interview_scores/get-all-interview_scores.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the interview_scores table.
 * @returns An array of interview_scores.
 */
export const getInterviewScores = async (): Promise<Tables<'interview_scores'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("interview_scores").select("*");

  if (error) {
    logError("Error fetching interview_scores", error);
    throw new Error("Failed to fetch interview_scores.");
  }

  return data || [];
};

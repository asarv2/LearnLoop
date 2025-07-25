// utils/queries/interview_scores/get-interview_scores-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all interview_scores related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of interview_scores.
 */
export const getInterviewScoresByTraining = async (trainingId: string): Promise<Tables<'interview_scores'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("interview_scores")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching interview_scores by training", error);
    throw new Error("Failed to fetch interview_scores.");
  }

  return data || [];
};

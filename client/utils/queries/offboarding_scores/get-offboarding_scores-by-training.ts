// utils/queries/offboarding_scores/get-offboarding_scores-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all offboarding_scores related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of offboarding_scores.
 */
export const getOffboardingScoresByTraining = async (trainingId: string): Promise<Tables<'offboarding_scores'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("offboarding_scores")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching offboarding_scores by training", error);
    throw new Error("Failed to fetch offboarding_scores.");
  }

  return data || [];
};

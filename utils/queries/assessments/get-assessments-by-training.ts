// utils/queries/assessments/get-assessments-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all assessments related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of assessments.
 */
export const getAssessmentsByTraining = async (trainingId: string): Promise<Tables<'assessments'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching assessments by training", error);
    throw new Error("Failed to fetch assessments.");
  }

  return data || [];
};

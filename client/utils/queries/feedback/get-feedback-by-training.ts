// utils/queries/feedback/get-feedback-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all feedback related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of feedback.
 */
export const getFeedbackByTraining = async (trainingId: string): Promise<Tables<'feedback'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching feedback by training", error);
    throw new Error("Failed to fetch feedback.");
  }

  return data || [];
};

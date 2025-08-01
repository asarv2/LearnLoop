// utils/queries/attempts/get-attempts-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all attempts related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of attempts.
 */
export const getAttemptsByTraining = async (trainingId: string): Promise<Tables<'attempts'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching attempts by training", error);
    throw new Error("Failed to fetch attempts.");
  }

  return data || [];
};

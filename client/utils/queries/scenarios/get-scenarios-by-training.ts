// utils/queries/scenarios/get-scenarios-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all scenarios related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of scenarios.
 */
export const getScenariosByTraining = async (trainingId: string): Promise<Tables<'scenarios'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching scenarios by training", error);
    throw new Error("Failed to fetch scenarios.");
  }

  return data || [];
};

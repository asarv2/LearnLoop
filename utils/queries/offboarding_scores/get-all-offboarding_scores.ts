// utils/queries/offboarding_scores/get-all-offboarding_scores.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the offboarding_scores table.
 * @returns An array of offboarding_scores.
 */
export const getOffboardingScores = async (): Promise<Tables<'offboarding_scores'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("offboarding_scores").select("*");

  if (error) {
    logError("Error fetching offboarding_scores", error);
    throw new Error("Failed to fetch offboarding_scores.");
  }

  return data || [];
};

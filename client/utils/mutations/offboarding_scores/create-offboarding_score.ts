// utils/mutations/offboarding_scores/create-offboarding_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new offboarding_score in the database.
 * @param newData The data for the new offboarding_score.
 * @returns The newly created offboarding_score.
 */
export const createOffboardingScore = async (newData: TablesInsert<'offboarding_scores'>): Promise<Tables<'offboarding_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("offboarding_scores")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating offboarding_score", error);
    throw new Error("Failed to create offboarding_score.");
  }

  return data;
};

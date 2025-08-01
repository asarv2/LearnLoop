// utils/mutations/offboarding_scores/update-offboarding_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing offboarding_score.
 * @param id The primary key of the offboarding_score to update.
 * @param updates The data to update.
 * @returns The updated offboarding_score.
 */
export const updateOffboardingScore = async (id: string, updates: TablesUpdate<'offboarding_scores'>): Promise<Tables<'offboarding_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("offboarding_scores")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating offboarding_score", error);
    throw new Error("Failed to update offboarding_score.");
  }
  
  return data;
};

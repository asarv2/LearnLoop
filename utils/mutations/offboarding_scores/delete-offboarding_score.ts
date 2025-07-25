// utils/mutations/offboarding_scores/delete-offboarding_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a offboarding_score from the database.
 * @param id The primary key of the offboarding_score to delete.
 * @returns The deleted data.
 */
export const deleteOffboardingScore = async (id: string): Promise<Tables<'offboarding_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("offboarding_scores")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting offboarding_score", error);
    throw new Error("Failed to delete offboarding_score.");
  }
  
  return data;
};

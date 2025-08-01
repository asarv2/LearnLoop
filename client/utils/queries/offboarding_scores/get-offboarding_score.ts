// utils/queries/offboarding_scores/get-offboarding_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single offboarding_score by its primary key.
 * @param id The primary key of the offboarding_score.
 * @returns The offboarding_score object or null if not found.
 */
export const getOffboardingScore = async (id: string): Promise<Tables<'offboarding_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("offboarding_scores")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching offboarding_score", error);
    throw new Error("Failed to fetch offboarding_score.");
  }

  return data;
};

// utils/queries/attempts/get-attempts-by-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all attempts related to a specific profile.
 * @param profileId The ID of the related profile.
 * @returns An array of attempts.
 */
export const getAttemptsByProfile = async (profileId: string): Promise<Tables<'attempts'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("profile_id", profileId);

  if (error) {
    logError("Error fetching attempts by profile", error);
    throw new Error("Failed to fetch attempts.");
  }

  return data || [];
};

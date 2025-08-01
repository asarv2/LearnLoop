// utils/queries/profiles/get-all-profiles.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the profiles table.
 * @returns An array of profiles.
 */
export const getProfiles = async (): Promise<Tables<'profiles'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("profiles").select("*");

  if (error) {
    logError("Error fetching profiles", error);
    throw new Error("Failed to fetch profiles.");
  }

  return data || [];
};

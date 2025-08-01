// utils/queries/personas/get-personas-by-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all personas related to a specific profile.
 * @param profileId The ID of the related profile.
 * @returns An array of personas.
 */
export const getPersonasByProfile = async (profileId: string): Promise<Tables<'personas'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .eq("profile_id", profileId);

  if (error) {
    logError("Error fetching personas by profile", error);
    throw new Error("Failed to fetch personas.");
  }

  return data || [];
};

// utils/queries/profiles/get-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single profile by its primary key.
 * @param id The primary key of the profile.
 * @returns The profile object or null if not found.
 */
export const getProfile = async (id: string): Promise<Tables<'profiles'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching profile", error);
    throw new Error("Failed to fetch profile.");
  }

  return data;
};

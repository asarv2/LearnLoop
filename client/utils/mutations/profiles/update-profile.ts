// utils/mutations/profiles/update-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing profile.
 * @param id The primary key of the profile to update.
 * @param updates The data to update.
 * @returns The updated profile.
 */
export const updateProfile = async (id: string, updates: TablesUpdate<'profiles'>): Promise<Tables<'profiles'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating profile", error);
    throw new Error("Failed to update profile.");
  }
  
  return data;
};

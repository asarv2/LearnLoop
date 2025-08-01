// utils/mutations/profiles/delete-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a profile from the database.
 * @param id The primary key of the profile to delete.
 * @returns The deleted data.
 */
export const deleteProfile = async (id: string): Promise<Tables<'profiles'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting profile", error);
    throw new Error("Failed to delete profile.");
  }
  
  return data;
};

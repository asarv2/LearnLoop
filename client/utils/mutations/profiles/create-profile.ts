// utils/mutations/profiles/create-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new profile in the database.
 * @param newData The data for the new profile.
 * @returns The newly created profile.
 */
export const createProfile = async (newData: TablesInsert<'profiles'>): Promise<Tables<'profiles'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("profiles")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating profile", error);
    throw new Error("Failed to create profile.");
  }

  return data;
};

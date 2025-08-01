// utils/mutations/attempts/update-attempt.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing attempt.
 * @param id The primary key of the attempt to update.
 * @param updates The data to update.
 * @returns The updated attempt.
 */
export const updateAttempt = async (id: string, updates: TablesUpdate<'attempts'>): Promise<Tables<'attempts'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("attempts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating attempt", error);
    throw new Error("Failed to update attempt.");
  }
  
  return data;
};

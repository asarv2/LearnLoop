// utils/mutations/attempts/delete-attempt.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a attempt from the database.
 * @param id The primary key of the attempt to delete.
 * @returns The deleted data.
 */
export const deleteAttempt = async (id: string): Promise<Tables<'attempts'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("attempts")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting attempt", error);
    throw new Error("Failed to delete attempt.");
  }
  
  return data;
};

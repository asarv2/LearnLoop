// utils/mutations/hints/delete-hint.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a hint from the database.
 * @param id The primary key of the hint to delete.
 * @returns The deleted data.
 */
export const deleteHint = async (id: string): Promise<Tables<'hints'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("hints")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting hint", error);
    throw new Error("Failed to delete hint.");
  }
  
  return data;
};

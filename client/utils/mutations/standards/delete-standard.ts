// utils/mutations/standards/delete-standard.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a standard from the database.
 * @param id The primary key of the standard to delete.
 * @returns The deleted data.
 */
export const deleteStandard = async (id: string): Promise<Tables<'standards'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standards")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting standard", error);
    throw new Error("Failed to delete standard.");
  }
  
  return data;
};

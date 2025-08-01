// utils/mutations/parameters/delete-parameter.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a parameter from the database.
 * @param id The primary key of the parameter to delete.
 * @returns The deleted data.
 */
export const deleteParameter = async (id: string): Promise<Tables<'parameters'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("parameters")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting parameter", error);
    throw new Error("Failed to delete parameter.");
  }
  
  return data;
};

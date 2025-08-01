// utils/mutations/fields/delete-field.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a field from the database.
 * @param id The primary key of the field to delete.
 * @returns The deleted data.
 */
export const deleteField = async (id: string): Promise<Tables<'fields'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("fields")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting field", error);
    throw new Error("Failed to delete field.");
  }
  
  return data;
};

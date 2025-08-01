// utils/mutations/fields/update-field.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing field.
 * @param id The primary key of the field to update.
 * @param updates The data to update.
 * @returns The updated field.
 */
export const updateField = async (id: string, updates: TablesUpdate<'fields'>): Promise<Tables<'fields'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("fields")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating field", error);
    throw new Error("Failed to update field.");
  }
  
  return data;
};

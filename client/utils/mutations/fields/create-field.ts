// utils/mutations/fields/create-field.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new field in the database.
 * @param newData The data for the new field.
 * @returns The newly created field.
 */
export const createField = async (newData: TablesInsert<'fields'>): Promise<Tables<'fields'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("fields")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating field", error);
    throw new Error("Failed to create field.");
  }

  return data;
};

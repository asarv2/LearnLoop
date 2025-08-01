// utils/mutations/standards/create-standard.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new standard in the database.
 * @param newData The data for the new standard.
 * @returns The newly created standard.
 */
export const createStandard = async (newData: TablesInsert<'standards'>): Promise<Tables<'standards'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standards")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating standard", error);
    throw new Error("Failed to create standard.");
  }

  return data;
};

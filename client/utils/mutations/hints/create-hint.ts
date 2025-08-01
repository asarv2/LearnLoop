// utils/mutations/hints/create-hint.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new hint in the database.
 * @param newData The data for the new hint.
 * @returns The newly created hint.
 */
export const createHint = async (newData: TablesInsert<'hints'>): Promise<Tables<'hints'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("hints")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating hint", error);
    throw new Error("Failed to create hint.");
  }

  return data;
};

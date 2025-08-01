// utils/mutations/attempts/create-attempt.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new attempt in the database.
 * @param newData The data for the new attempt.
 * @returns The newly created attempt.
 */
export const createAttempt = async (newData: TablesInsert<'attempts'>): Promise<Tables<'attempts'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("attempts")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating attempt", error);
    throw new Error("Failed to create attempt.");
  }

  return data;
};

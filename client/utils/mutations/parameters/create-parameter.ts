// utils/mutations/parameters/create-parameter.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new parameter in the database.
 * @param newData The data for the new parameter.
 * @returns The newly created parameter.
 */
export const createParameter = async (newData: TablesInsert<'parameters'>): Promise<Tables<'parameters'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("parameters")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating parameter", error);
    throw new Error("Failed to create parameter.");
  }

  return data;
};

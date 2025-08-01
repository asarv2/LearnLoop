// utils/mutations/rubrics/create-rubric.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new rubric in the database.
 * @param newData The data for the new rubric.
 * @returns The newly created rubric.
 */
export const createRubric = async (newData: TablesInsert<'rubrics'>): Promise<Tables<'rubrics'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubrics")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating rubric", error);
    throw new Error("Failed to create rubric.");
  }

  return data;
};

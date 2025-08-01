// utils/mutations/rubrics/update-rubric.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing rubric.
 * @param id The primary key of the rubric to update.
 * @param updates The data to update.
 * @returns The updated rubric.
 */
export const updateRubric = async (id: string, updates: TablesUpdate<'rubrics'>): Promise<Tables<'rubrics'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubrics")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating rubric", error);
    throw new Error("Failed to update rubric.");
  }
  
  return data;
};

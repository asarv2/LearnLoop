// utils/mutations/rubrics/delete-rubric.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a rubric from the database.
 * @param id The primary key of the rubric to delete.
 * @returns The deleted data.
 */
export const deleteRubric = async (id: string): Promise<Tables<'rubrics'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubrics")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting rubric", error);
    throw new Error("Failed to delete rubric.");
  }
  
  return data;
};

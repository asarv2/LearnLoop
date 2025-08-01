// utils/mutations/standard_grades/update-standard_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing standard_grade.
 * @param id The primary key of the standard_grade to update.
 * @param updates The data to update.
 * @returns The updated standard_grade.
 */
export const updateStandardGrade = async (id: string, updates: TablesUpdate<'standard_grades'>): Promise<Tables<'standard_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standard_grades")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating standard_grade", error);
    throw new Error("Failed to update standard_grade.");
  }
  
  return data;
};

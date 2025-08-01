// utils/mutations/rubric_grades/update-rubric_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing rubric_grade.
 * @param id The primary key of the rubric_grade to update.
 * @param updates The data to update.
 * @returns The updated rubric_grade.
 */
export const updateRubricGrade = async (id: string, updates: TablesUpdate<'rubric_grades'>): Promise<Tables<'rubric_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubric_grades")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating rubric_grade", error);
    throw new Error("Failed to update rubric_grade.");
  }
  
  return data;
};

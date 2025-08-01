// utils/mutations/rubric_grades/delete-rubric_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a rubric_grade from the database.
 * @param id The primary key of the rubric_grade to delete.
 * @returns The deleted data.
 */
export const deleteRubricGrade = async (id: string): Promise<Tables<'rubric_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubric_grades")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting rubric_grade", error);
    throw new Error("Failed to delete rubric_grade.");
  }
  
  return data;
};

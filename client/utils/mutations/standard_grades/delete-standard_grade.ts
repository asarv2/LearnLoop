// utils/mutations/standard_grades/delete-standard_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a standard_grade from the database.
 * @param id The primary key of the standard_grade to delete.
 * @returns The deleted data.
 */
export const deleteStandardGrade = async (id: string): Promise<Tables<'standard_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standard_grades")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting standard_grade", error);
    throw new Error("Failed to delete standard_grade.");
  }
  
  return data;
};

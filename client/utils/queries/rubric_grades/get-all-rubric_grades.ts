// utils/queries/rubric_grades/get-all-rubric_grades.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the rubric_grades table.
 * @returns An array of rubric_grades.
 */
export const getRubricGrades = async (): Promise<Tables<'rubric_grades'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("rubric_grades").select("*");

  if (error) {
    logError("Error fetching rubric_grades", error);
    throw new Error("Failed to fetch rubric_grades.");
  }

  return data || [];
};

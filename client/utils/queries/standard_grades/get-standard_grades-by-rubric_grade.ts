// utils/queries/standard_grades/get-standard_grades-by-rubric_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all standard_grades related to a specific rubric_grade.
 * @param rubric_gradeId The ID of the related rubric_grade.
 * @returns An array of standard_grades.
 */
export const getStandardGradesByRubricGrade = async (rubric_gradeId: string): Promise<Tables<'standard_grades'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standard_grades")
    .select("*")
    .eq("rubric_grade_id", rubric_gradeId);

  if (error) {
    logError("Error fetching standard_grades by rubric_grade", error);
    throw new Error("Failed to fetch standard_grades.");
  }

  return data || [];
};

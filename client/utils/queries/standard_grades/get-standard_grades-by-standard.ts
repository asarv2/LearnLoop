// utils/queries/standard_grades/get-standard_grades-by-standard.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all standard_grades related to a specific standard.
 * @param standardId The ID of the related standard.
 * @returns An array of standard_grades.
 */
export const getStandardGradesByStandard = async (standardId: string): Promise<Tables<'standard_grades'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standard_grades")
    .select("*")
    .eq("standard_id", standardId);

  if (error) {
    logError("Error fetching standard_grades by standard", error);
    throw new Error("Failed to fetch standard_grades.");
  }

  return data || [];
};

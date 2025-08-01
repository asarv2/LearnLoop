// utils/queries/standard_grades/get-all-standard_grades.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the standard_grades table.
 * @returns An array of standard_grades.
 */
export const getStandardGrades = async (): Promise<Tables<'standard_grades'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("standard_grades").select("*");

  if (error) {
    logError("Error fetching standard_grades", error);
    throw new Error("Failed to fetch standard_grades.");
  }

  return data || [];
};

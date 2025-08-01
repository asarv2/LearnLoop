// utils/queries/assessments/get-all-assessments.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the assessments table.
 * @returns An array of assessments.
 */
export const getAssessments = async (): Promise<Tables<'assessments'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("assessments").select("*");

  if (error) {
    logError("Error fetching assessments", error);
    throw new Error("Failed to fetch assessments.");
  }

  return data || [];
};

// utils/queries/assessments/get-assessment.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single assessment by its primary key.
 * @param id The primary key of the assessment.
 * @returns The assessment object or null if not found.
 */
export const getAssessment = async (id: string): Promise<Tables<'assessments'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching assessment", error);
    throw new Error("Failed to fetch assessment.");
  }

  return data;
};

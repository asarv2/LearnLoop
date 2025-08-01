// utils/mutations/assessments/create-assessment.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new assessment in the database.
 * @param newData The data for the new assessment.
 * @returns The newly created assessment.
 */
export const createAssessment = async (newData: TablesInsert<'assessments'>): Promise<Tables<'assessments'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("assessments")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating assessment", error);
    throw new Error("Failed to create assessment.");
  }

  return data;
};

// utils/mutations/assessments/update-assessment.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing assessment.
 * @param id The primary key of the assessment to update.
 * @param updates The data to update.
 * @returns The updated assessment.
 */
export const updateAssessment = async (id: string, updates: TablesUpdate<'assessments'>): Promise<Tables<'assessments'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("assessments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating assessment", error);
    throw new Error("Failed to update assessment.");
  }
  
  return data;
};

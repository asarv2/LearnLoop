// utils/mutations/assessments/delete-assessment.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a assessment from the database.
 * @param id The primary key of the assessment to delete.
 * @returns The deleted data.
 */
export const deleteAssessment = async (id: string): Promise<Tables<'assessments'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("assessments")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting assessment", error);
    throw new Error("Failed to delete assessment.");
  }
  
  return data;
};

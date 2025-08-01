// utils/queries/questions/get-questions-by-assessment.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all questions related to a specific assessment.
 * @param assessmentId The ID of the related assessment.
 * @returns An array of questions.
 */
export const getQuestionsByAssessment = async (assessmentId: string): Promise<Tables<'questions'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("assessment_id", assessmentId);

  if (error) {
    logError("Error fetching questions by assessment", error);
    throw new Error("Failed to fetch questions.");
  }

  return data || [];
};

// utils/mutations/interview_scores/create-interview_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new interview_score in the database.
 * @param newData The data for the new interview_score.
 * @returns The newly created interview_score.
 */
export const createInterviewScore = async (newData: TablesInsert<'interview_scores'>): Promise<Tables<'interview_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("interview_scores")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating interview_score", error);
    throw new Error("Failed to create interview_score.");
  }

  return data;
};

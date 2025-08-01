// utils/queries/interview_scores/get-interview_score.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single interview_score by its primary key.
 * @param id The primary key of the interview_score.
 * @returns The interview_score object or null if not found.
 */
export const getInterviewScore = async (id: string): Promise<Tables<'interview_scores'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("interview_scores")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching interview_score", error);
    throw new Error("Failed to fetch interview_score.");
  }

  return data;
};

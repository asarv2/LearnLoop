// utils/queries/questions/get-all-questions.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the questions table.
 * @returns An array of questions.
 */
export const getQuestions = async (): Promise<Tables<'questions'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("questions").select("*");

  if (error) {
    logError("Error fetching questions", error);
    throw new Error("Failed to fetch questions.");
  }

  return data || [];
};

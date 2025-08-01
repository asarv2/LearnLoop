// utils/queries/questions/get-question.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single question by its primary key.
 * @param id The primary key of the question.
 * @returns The question object or null if not found.
 */
export const getQuestion = async (id: string): Promise<Tables<'questions'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching question", error);
    throw new Error("Failed to fetch question.");
  }

  return data;
};

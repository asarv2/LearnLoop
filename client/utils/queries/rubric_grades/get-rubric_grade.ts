// utils/queries/rubric_grades/get-rubric_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single rubric_grade by its primary key.
 * @param id The primary key of the rubric_grade.
 * @returns The rubric_grade object or null if not found.
 */
export const getRubricGrade = async (id: string): Promise<Tables<'rubric_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubric_grades")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching rubric_grade", error);
    throw new Error("Failed to fetch rubric_grade.");
  }

  return data;
};

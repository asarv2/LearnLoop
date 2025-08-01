// utils/queries/standard_grades/get-standard_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single standard_grade by its primary key.
 * @param id The primary key of the standard_grade.
 * @returns The standard_grade object or null if not found.
 */
export const getStandardGrade = async (id: string): Promise<Tables<'standard_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standard_grades")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching standard_grade", error);
    throw new Error("Failed to fetch standard_grade.");
  }

  return data;
};

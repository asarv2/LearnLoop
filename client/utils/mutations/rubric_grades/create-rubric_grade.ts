// utils/mutations/rubric_grades/create-rubric_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new rubric_grade in the database.
 * @param newData The data for the new rubric_grade.
 * @returns The newly created rubric_grade.
 */
export const createRubricGrade = async (newData: TablesInsert<'rubric_grades'>): Promise<Tables<'rubric_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubric_grades")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating rubric_grade", error);
    throw new Error("Failed to create rubric_grade.");
  }

  return data;
};

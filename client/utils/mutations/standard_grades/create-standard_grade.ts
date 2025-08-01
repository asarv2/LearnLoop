// utils/mutations/standard_grades/create-standard_grade.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new standard_grade in the database.
 * @param newData The data for the new standard_grade.
 * @returns The newly created standard_grade.
 */
export const createStandardGrade = async (newData: TablesInsert<'standard_grades'>): Promise<Tables<'standard_grades'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standard_grades")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating standard_grade", error);
    throw new Error("Failed to create standard_grade.");
  }

  return data;
};

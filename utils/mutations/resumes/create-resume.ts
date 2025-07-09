// utils/mutations/resumes/create-resume.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert } from "@/database.types";

/**
 * Creates a new resume in the database.
 * @param newData The data for the new resume.
 * @returns The newly created resume. The return type is inferred.
 */
export const createResume = async (newData: TablesInsert<'resumes'>) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("resumes")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating resume", error);
    throw new Error("Failed to create resume.");
  }

  return data;
};

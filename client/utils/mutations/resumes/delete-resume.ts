// utils/mutations/resumes/delete-resume.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a resume from the database.
 * @param id The primary key of the resume to delete.
 * @returns The deleted data.
 */
export const deleteResume = async (id: string): Promise<Tables<'resumes'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting resume", error);
    throw new Error("Failed to delete resume.");
  }
  
  return data;
};

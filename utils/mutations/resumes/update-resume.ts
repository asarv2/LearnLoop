// utils/mutations/resumes/update-resume.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing resume.
 * @param id The primary key of the resume to update.
 * @param updates The data to update.
 * @returns The updated resume.
 */
export const updateResume = async (id: string, updates: TablesUpdate<'resumes'>): Promise<Tables<'resumes'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("resumes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating resume", error);
    throw new Error("Failed to update resume.");
  }
  
  return data;
};

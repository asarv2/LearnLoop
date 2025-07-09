// utils/queries/resumes/get-resume.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches a single resume by its primary key.
 * @param id The primary key of the resume.
 * @returns The resume object or null if not found. The return type is inferred.
 */
export const getResume = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching resume", error);
    throw new Error("Failed to fetch resume.");
  }

  return data;
};

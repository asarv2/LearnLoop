// utils/queries/resumes/get-resume.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single resume by its primary key.
 * @param id The primary key of the resume.
 * @returns The resume object or null if not found.
 */
export const getResume = async (id: string): Promise<Tables<'resumes'>> => {
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

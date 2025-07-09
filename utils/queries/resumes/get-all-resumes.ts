// utils/queries/resumes/get-all-resumes.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches all records from the resumes table.
 * @returns An array of resumes. The return type is inferred.
 */
export const getResumes = async () => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("resumes").select("*");

  if (error) {
    logError("Error fetching resumes", error);
    throw new Error("Failed to fetch resumes.");
  }

  return data || [];
};

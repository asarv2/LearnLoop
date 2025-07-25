// utils/queries/resumes/get-resumes-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all resumes related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of resumes.
 */
export const getResumesByTraining = async (trainingId: string): Promise<Tables<'resumes'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching resumes by training", error);
    throw new Error("Failed to fetch resumes.");
  }

  return data || [];
};

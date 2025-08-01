// utils/queries/feedback/get-all-feedback.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the feedback table.
 * @returns An array of feedback.
 */
export const getFeedback = async (): Promise<Tables<'feedback'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("feedback").select("*");

  if (error) {
    logError("Error fetching feedback", error);
    throw new Error("Failed to fetch feedback.");
  }

  return data || [];
};

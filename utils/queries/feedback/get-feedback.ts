// utils/queries/feedback/get-feedback.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches a single feedback by its primary key.
 * @param id The primary key of the feedback.
 * @returns The feedback object or null if not found. The return type is inferred.
 */
export const getFeedback = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching feedback", error);
    throw new Error("Failed to fetch feedback.");
  }

  return data;
};

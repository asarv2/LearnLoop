// utils/mutations/feedback/create-feedback.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert } from "@/database.types";

/**
 * Creates a new feedback in the database.
 * @param newData The data for the new feedback.
 * @returns The newly created feedback. The return type is inferred.
 */
export const createFeedback = async (newData: TablesInsert<'feedback'>) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("feedback")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating feedback", error);
    throw new Error("Failed to create feedback.");
  }

  return data;
};

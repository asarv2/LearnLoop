// utils/mutations/feedback/update-feedback.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate } from "@/database.types";

/**
 * Updates an existing feedback.
 * @param id The primary key of the feedback to update.
 * @param updates The data to update.
 * @returns The updated feedback. The return type is inferred.
 */
export const updateFeedback = async (id: string, updates: TablesUpdate<'feedback'>) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("feedback")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating feedback", error);
    throw new Error("Failed to update feedback.");
  }
  
  return data;
};

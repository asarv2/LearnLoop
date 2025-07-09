// utils/mutations/feedback/delete-feedback.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Deletes a feedback from the database.
 * @param id The primary key of the feedback to delete.
 * @returns The deleted data. The return type is inferred.
 */
export const deleteFeedback = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("feedback")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting feedback", error);
    throw new Error("Failed to delete feedback.");
  }
  
  return data;
};

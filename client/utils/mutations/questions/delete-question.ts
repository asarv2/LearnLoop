// utils/mutations/questions/delete-question.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a question from the database.
 * @param id The primary key of the question to delete.
 * @returns The deleted data.
 */
export const deleteQuestion = async (id: string): Promise<Tables<'questions'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("questions")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting question", error);
    throw new Error("Failed to delete question.");
  }
  
  return data;
};

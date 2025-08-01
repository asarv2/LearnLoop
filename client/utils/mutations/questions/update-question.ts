// utils/mutations/questions/update-question.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing question.
 * @param id The primary key of the question to update.
 * @param updates The data to update.
 * @returns The updated question.
 */
export const updateQuestion = async (id: string, updates: TablesUpdate<'questions'>): Promise<Tables<'questions'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("questions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating question", error);
    throw new Error("Failed to update question.");
  }
  
  return data;
};

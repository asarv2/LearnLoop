// utils/mutations/questions/create-question.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new question in the database.
 * @param newData The data for the new question.
 * @returns The newly created question.
 */
export const createQuestion = async (newData: TablesInsert<'questions'>): Promise<Tables<'questions'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("questions")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating question", error);
    throw new Error("Failed to create question.");
  }

  return data;
};

// utils/mutations/trainings/update-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing training.
 * @param id The primary key of the training to update.
 * @param updates The data to update.
 * @returns The updated training.
 */
export const updateTraining = async (id: string, updates: TablesUpdate<'trainings'>): Promise<Tables<'trainings'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("trainings")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating training", error);
    throw new Error("Failed to update training.");
  }
  
  return data;
};

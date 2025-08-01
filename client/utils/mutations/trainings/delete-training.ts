// utils/mutations/trainings/delete-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a training from the database.
 * @param id The primary key of the training to delete.
 * @returns The deleted data.
 */
export const deleteTraining = async (id: string): Promise<Tables<'trainings'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("trainings")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting training", error);
    throw new Error("Failed to delete training.");
  }
  
  return data;
};

// utils/mutations/trainings/create-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new training in the database.
 * @param newData The data for the new training.
 * @returns The newly created training.
 */
export const createTraining = async (newData: TablesInsert<'trainings'>): Promise<Tables<'trainings'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("trainings")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating training", error);
    throw new Error("Failed to create training.");
  }

  return data;
};

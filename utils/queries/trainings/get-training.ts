// utils/queries/trainings/get-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single training by its primary key.
 * @param id The primary key of the training.
 * @returns The training object or null if not found.
 */
export const getTraining = async (id: string): Promise<Tables<'trainings'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("trainings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching training", error);
    throw new Error("Failed to fetch training.");
  }

  return data;
};

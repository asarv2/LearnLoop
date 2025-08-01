// utils/queries/logs/get-logs-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all logs related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of logs.
 */
export const getLogsByTraining = async (trainingId: string): Promise<Tables<'logs'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching logs by training", error);
    throw new Error("Failed to fetch logs.");
  }

  return data || [];
};

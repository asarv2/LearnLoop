// utils/queries/attempts/get-all-attempts-with-training.ts
"use server";

import type { Tables } from "@/database.types";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";

export type AttemptWithTraining = Tables<"attempts"> & {
  trainings: Tables<"trainings"> | null;
};

/**
 * Fetches all attempts with their related training data.
 * @returns An array of attempts with training information.
 */
export const getAllAttemptsWithTraining = async (): Promise<
  AttemptWithTraining[]
> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("attempts")
    .select(
      `
      *,
      trainings (*)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    logError("Error fetching attempts with training", error);
    throw new Error("Failed to fetch attempts.");
  }

  return data || [];
};

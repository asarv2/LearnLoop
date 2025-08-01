// utils/queries/trainings/get-all-trainings.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the trainings table.
 * @returns An array of trainings.
 */
export const getTrainings = async (): Promise<Tables<'trainings'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("trainings").select("*");

  if (error) {
    logError("Error fetching trainings", error);
    throw new Error("Failed to fetch trainings.");
  }

  return data || [];
};

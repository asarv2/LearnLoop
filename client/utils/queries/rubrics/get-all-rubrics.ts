// utils/queries/rubrics/get-all-rubrics.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the rubrics table.
 * @returns An array of rubrics.
 */
export const getRubrics = async (): Promise<Tables<'rubrics'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("rubrics").select("*");

  if (error) {
    logError("Error fetching rubrics", error);
    throw new Error("Failed to fetch rubrics.");
  }

  return data || [];
};

// utils/queries/scenarios/get-all-scenarios.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the scenarios table.
 * @returns An array of scenarios.
 */
export const getScenarios = async (): Promise<Tables<'scenarios'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("scenarios").select("*");

  if (error) {
    logError("Error fetching scenarios", error);
    throw new Error("Failed to fetch scenarios.");
  }

  return data || [];
};

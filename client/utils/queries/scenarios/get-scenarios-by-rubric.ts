// utils/queries/scenarios/get-scenarios-by-rubric.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all scenarios related to a specific rubric.
 * @param rubricId The ID of the related rubric.
 * @returns An array of scenarios.
 */
export const getScenariosByRubric = async (rubricId: string): Promise<Tables<'scenarios'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("rubric_id", rubricId);

  if (error) {
    logError("Error fetching scenarios by rubric", error);
    throw new Error("Failed to fetch scenarios.");
  }

  return data || [];
};

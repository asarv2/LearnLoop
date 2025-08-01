// utils/queries/scenarios/get-scenario.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single scenario by its primary key.
 * @param id The primary key of the scenario.
 * @returns The scenario object or null if not found.
 */
export const getScenario = async (id: string): Promise<Tables<'scenarios'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching scenario", error);
    throw new Error("Failed to fetch scenario.");
  }

  return data;
};

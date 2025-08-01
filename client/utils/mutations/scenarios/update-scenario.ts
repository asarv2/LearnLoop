// utils/mutations/scenarios/update-scenario.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing scenario.
 * @param id The primary key of the scenario to update.
 * @param updates The data to update.
 * @returns The updated scenario.
 */
export const updateScenario = async (id: string, updates: TablesUpdate<'scenarios'>): Promise<Tables<'scenarios'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("scenarios")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating scenario", error);
    throw new Error("Failed to update scenario.");
  }
  
  return data;
};

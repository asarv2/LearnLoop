// utils/mutations/scenarios/delete-scenario.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a scenario from the database.
 * @param id The primary key of the scenario to delete.
 * @returns The deleted data.
 */
export const deleteScenario = async (id: string): Promise<Tables<'scenarios'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("scenarios")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting scenario", error);
    throw new Error("Failed to delete scenario.");
  }
  
  return data;
};

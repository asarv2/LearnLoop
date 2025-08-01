// utils/mutations/scenarios/create-scenario.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new scenario in the database.
 * @param newData The data for the new scenario.
 * @returns The newly created scenario.
 */
export const createScenario = async (newData: TablesInsert<'scenarios'>): Promise<Tables<'scenarios'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("scenarios")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating scenario", error);
    throw new Error("Failed to create scenario.");
  }

  return data;
};

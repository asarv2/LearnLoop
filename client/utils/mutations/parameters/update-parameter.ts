// utils/mutations/parameters/update-parameter.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing parameter.
 * @param id The primary key of the parameter to update.
 * @param updates The data to update.
 * @returns The updated parameter.
 */
export const updateParameter = async (id: string, updates: TablesUpdate<'parameters'>): Promise<Tables<'parameters'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("parameters")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating parameter", error);
    throw new Error("Failed to update parameter.");
  }
  
  return data;
};

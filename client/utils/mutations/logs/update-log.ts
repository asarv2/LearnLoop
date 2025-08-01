// utils/mutations/logs/update-log.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing log.
 * @param id The primary key of the log to update.
 * @param updates The data to update.
 * @returns The updated log.
 */
export const updateLog = async (id: string, updates: TablesUpdate<'logs'>): Promise<Tables<'logs'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("logs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating log", error);
    throw new Error("Failed to update log.");
  }
  
  return data;
};

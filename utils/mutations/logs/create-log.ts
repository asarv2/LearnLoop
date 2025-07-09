// utils/mutations/logs/create-log.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new log in the database.
 * @param newData The data for the new log.
 * @returns The newly created log.
 */
export const createLog = async (newData: TablesInsert<'logs'>): Promise<Tables<'logs'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("logs")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating log", error);
    throw new Error("Failed to create log.");
  }

  return data;
};

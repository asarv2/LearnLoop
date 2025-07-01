// utils/mutations/logs/create-log.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert } from "@/database.types";

/**
 * Creates a new log in the database.
 * @param newData The data for the new log.
 * @returns The newly created log. The return type is inferred.
 */
export const createLog = async (newData: TablesInsert<'logs'>) => {
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

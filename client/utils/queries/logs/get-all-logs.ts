// utils/queries/logs/get-all-logs.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the logs table.
 * @returns An array of logs.
 */
export const getLogs = async (): Promise<Tables<'logs'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("logs").select("*");

  if (error) {
    logError("Error fetching logs", error);
    throw new Error("Failed to fetch logs.");
  }

  return data || [];
};

// utils/queries/logs/get-all-logs.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches all records from the logs table.
 * @returns An array of logs. The return type is inferred.
 */
export const getLogs = async () => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("logs").select("*");

  if (error) {
    logError("Error fetching logs", error);
    throw new Error("Failed to fetch logs.");
  }

  return data || [];
};

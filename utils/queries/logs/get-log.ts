// utils/queries/logs/get-log.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches a single log by its primary key.
 * @param id The primary key of the log.
 * @returns The log object or null if not found. The return type is inferred.
 */
export const getLog = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching log", error);
    throw new Error("Failed to fetch log.");
  }

  return data;
};

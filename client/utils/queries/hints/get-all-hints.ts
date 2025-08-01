// utils/queries/hints/get-all-hints.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the hints table.
 * @returns An array of hints.
 */
export const getHints = async (): Promise<Tables<'hints'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("hints").select("*");

  if (error) {
    logError("Error fetching hints", error);
    throw new Error("Failed to fetch hints.");
  }

  return data || [];
};

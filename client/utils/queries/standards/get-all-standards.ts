// utils/queries/standards/get-all-standards.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the standards table.
 * @returns An array of standards.
 */
export const getStandards = async (): Promise<Tables<'standards'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("standards").select("*");

  if (error) {
    logError("Error fetching standards", error);
    throw new Error("Failed to fetch standards.");
  }

  return data || [];
};

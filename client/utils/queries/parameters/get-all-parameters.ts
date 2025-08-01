// utils/queries/parameters/get-all-parameters.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the parameters table.
 * @returns An array of parameters.
 */
export const getParameters = async (): Promise<Tables<'parameters'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("parameters").select("*");

  if (error) {
    logError("Error fetching parameters", error);
    throw new Error("Failed to fetch parameters.");
  }

  return data || [];
};

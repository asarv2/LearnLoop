// utils/queries/fields/get-all-fields.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the fields table.
 * @returns An array of fields.
 */
export const getFields = async (): Promise<Tables<'fields'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("fields").select("*");

  if (error) {
    logError("Error fetching fields", error);
    throw new Error("Failed to fetch fields.");
  }

  return data || [];
};

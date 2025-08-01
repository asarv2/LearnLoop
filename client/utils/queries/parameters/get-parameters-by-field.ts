// utils/queries/parameters/get-parameters-by-field.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all parameters related to a specific field.
 * @param fieldId The ID of the related field.
 * @returns An array of parameters.
 */
export const getParametersByField = async (fieldId: string): Promise<Tables<'parameters'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("parameters")
    .select("*")
    .eq("field_id", fieldId);

  if (error) {
    logError("Error fetching parameters by field", error);
    throw new Error("Failed to fetch parameters.");
  }

  return data || [];
};

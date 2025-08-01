// utils/queries/personas/get-all-personas.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the personas table.
 * @returns An array of personas.
 */
export const getPersonas = async (): Promise<Tables<'personas'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("personas").select("*");

  if (error) {
    logError("Error fetching personas", error);
    throw new Error("Failed to fetch personas.");
  }

  return data || [];
};

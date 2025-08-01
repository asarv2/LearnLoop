// utils/queries/standards/get-standard.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single standard by its primary key.
 * @param id The primary key of the standard.
 * @returns The standard object or null if not found.
 */
export const getStandard = async (id: string): Promise<Tables<'standards'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standards")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching standard", error);
    throw new Error("Failed to fetch standard.");
  }

  return data;
};

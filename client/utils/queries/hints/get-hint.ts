// utils/queries/hints/get-hint.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single hint by its primary key.
 * @param id The primary key of the hint.
 * @returns The hint object or null if not found.
 */
export const getHint = async (id: string): Promise<Tables<'hints'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("hints")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching hint", error);
    throw new Error("Failed to fetch hint.");
  }

  return data;
};

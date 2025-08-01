// utils/queries/attempts/get-attempt.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single attempt by its primary key.
 * @param id The primary key of the attempt.
 * @returns The attempt object or null if not found.
 */
export const getAttempt = async (id: string): Promise<Tables<'attempts'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching attempt", error);
    throw new Error("Failed to fetch attempt.");
  }

  return data;
};

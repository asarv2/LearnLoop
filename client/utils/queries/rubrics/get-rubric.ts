// utils/queries/rubrics/get-rubric.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single rubric by its primary key.
 * @param id The primary key of the rubric.
 * @returns The rubric object or null if not found.
 */
export const getRubric = async (id: string): Promise<Tables<'rubrics'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("rubrics")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching rubric", error);
    throw new Error("Failed to fetch rubric.");
  }

  return data;
};

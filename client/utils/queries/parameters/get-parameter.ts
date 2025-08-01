// utils/queries/parameters/get-parameter.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single parameter by its primary key.
 * @param id The primary key of the parameter.
 * @returns The parameter object or null if not found.
 */
export const getParameter = async (id: string): Promise<Tables<'parameters'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("parameters")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching parameter", error);
    throw new Error("Failed to fetch parameter.");
  }

  return data;
};

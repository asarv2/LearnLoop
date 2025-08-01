// utils/queries/personas/get-persona.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single persona by its primary key.
 * @param id The primary key of the persona.
 * @returns The persona object or null if not found.
 */
export const getPersona = async (id: string): Promise<Tables<'personas'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching persona", error);
    throw new Error("Failed to fetch persona.");
  }

  return data;
};

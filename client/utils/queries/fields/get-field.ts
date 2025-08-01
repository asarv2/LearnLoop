// utils/queries/fields/get-field.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single field by its primary key.
 * @param id The primary key of the field.
 * @returns The field object or null if not found.
 */
export const getField = async (id: string): Promise<Tables<'fields'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("fields")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching field", error);
    throw new Error("Failed to fetch field.");
  }

  return data;
};

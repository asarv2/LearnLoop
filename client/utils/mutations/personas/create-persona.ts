// utils/mutations/personas/create-persona.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new persona in the database.
 * @param newData The data for the new persona.
 * @returns The newly created persona.
 */
export const createPersona = async (newData: TablesInsert<'personas'>): Promise<Tables<'personas'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("personas")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating persona", error);
    throw new Error("Failed to create persona.");
  }

  return data;
};

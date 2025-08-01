// utils/mutations/personas/update-persona.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing persona.
 * @param id The primary key of the persona to update.
 * @param updates The data to update.
 * @returns The updated persona.
 */
export const updatePersona = async (id: string, updates: TablesUpdate<'personas'>): Promise<Tables<'personas'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("personas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating persona", error);
    throw new Error("Failed to update persona.");
  }
  
  return data;
};

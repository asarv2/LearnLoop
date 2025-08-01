// utils/mutations/personas/delete-persona.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a persona from the database.
 * @param id The primary key of the persona to delete.
 * @returns The deleted data.
 */
export const deletePersona = async (id: string): Promise<Tables<'personas'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("personas")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting persona", error);
    throw new Error("Failed to delete persona.");
  }
  
  return data;
};

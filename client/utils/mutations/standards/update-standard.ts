// utils/mutations/standards/update-standard.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing standard.
 * @param id The primary key of the standard to update.
 * @param updates The data to update.
 * @returns The updated standard.
 */
export const updateStandard = async (id: string, updates: TablesUpdate<'standards'>): Promise<Tables<'standards'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standards")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating standard", error);
    throw new Error("Failed to update standard.");
  }
  
  return data;
};

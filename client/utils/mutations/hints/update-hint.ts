// utils/mutations/hints/update-hint.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing hint.
 * @param id The primary key of the hint to update.
 * @param updates The data to update.
 * @returns The updated hint.
 */
export const updateHint = async (id: string, updates: TablesUpdate<'hints'>): Promise<Tables<'hints'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("hints")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating hint", error);
    throw new Error("Failed to update hint.");
  }
  
  return data;
};

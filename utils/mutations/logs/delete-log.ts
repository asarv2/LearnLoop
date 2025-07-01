// utils/mutations/logs/delete-log.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Deletes a log from the database.
 * @param id The primary key of the log to delete.
 * @returns The deleted data. The return type is inferred.
 */
export const deleteLog = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("logs")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting log", error);
    throw new Error("Failed to delete log.");
  }
  
  return data;
};

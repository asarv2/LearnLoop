// utils/mutations/messages/update-message.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate } from "@/database.types";

/**
 * Updates an existing message.
 * @param id The primary key of the message to update.
 * @param updates The data to update.
 * @returns The updated message. The return type is inferred.
 */
export const updateMessage = async (id: string, updates: TablesUpdate<'messages'>) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating message", error);
    throw new Error("Failed to update message.");
  }
  
  return data;
};

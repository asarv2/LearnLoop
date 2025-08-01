// utils/mutations/messages/delete-message.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a message from the database.
 * @param id The primary key of the message to delete.
 * @returns The deleted data.
 */
export const deleteMessage = async (id: string): Promise<Tables<'messages'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting message", error);
    throw new Error("Failed to delete message.");
  }
  
  return data;
};

// utils/mutations/chats/delete-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Deletes a chat from the database.
 * @param id The primary key of the chat to delete.
 * @returns The deleted data. The return type is inferred.
 */
export const deleteChat = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting chat", error);
    throw new Error("Failed to delete chat.");
  }
  
  return data;
};

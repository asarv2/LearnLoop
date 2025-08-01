// utils/mutations/chats/delete-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a chat from the database.
 * @param id The primary key of the chat to delete.
 * @returns The deleted data.
 */
export const deleteChat = async (id: string): Promise<Tables<'chats'>> => {
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

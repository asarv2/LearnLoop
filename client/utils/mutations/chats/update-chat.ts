// utils/mutations/chats/update-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing chat.
 * @param id The primary key of the chat to update.
 * @param updates The data to update.
 * @returns The updated chat.
 */
export const updateChat = async (id: string, updates: TablesUpdate<'chats'>): Promise<Tables<'chats'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating chat", error);
    throw new Error("Failed to update chat.");
  }
  
  return data;
};

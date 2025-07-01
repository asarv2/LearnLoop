// utils/mutations/chats/update-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate } from "@/database.types";

/**
 * Updates an existing chat.
 * @param id The primary key of the chat to update.
 * @param updates The data to update.
 * @returns The updated chat. The return type is inferred.
 */
export const updateChat = async (id: string, updates: TablesUpdate<'chats'>) => {
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

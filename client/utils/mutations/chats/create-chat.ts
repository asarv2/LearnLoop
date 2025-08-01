// utils/mutations/chats/create-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new chat in the database.
 * @param newData The data for the new chat.
 * @returns The newly created chat.
 */
export const createChat = async (newData: TablesInsert<'chats'>): Promise<Tables<'chats'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating chat", error);
    throw new Error("Failed to create chat.");
  }

  return data;
};

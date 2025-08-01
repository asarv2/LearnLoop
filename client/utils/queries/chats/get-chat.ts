// utils/queries/chats/get-chat.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single chat by its primary key.
 * @param id The primary key of the chat.
 * @returns The chat object or null if not found.
 */
export const getChat = async (id: string): Promise<Tables<'chats'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching chat", error);
    throw new Error("Failed to fetch chat.");
  }

  return data;
};

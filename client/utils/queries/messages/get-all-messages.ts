// utils/queries/messages/get-all-messages.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the messages table.
 * @returns An array of messages.
 */
export const getMessages = async (): Promise<Tables<'messages'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("messages").select("*");

  if (error) {
    logError("Error fetching messages", error);
    throw new Error("Failed to fetch messages.");
  }

  return data || [];
};

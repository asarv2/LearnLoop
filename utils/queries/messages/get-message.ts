// utils/queries/messages/get-message.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches a single message by its primary key.
 * @param id The primary key of the message.
 * @returns The message object or null if not found. The return type is inferred.
 */
export const getMessage = async (id: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching message", error);
    throw new Error("Failed to fetch message.");
  }

  return data;
};

// utils/queries/chats/get-all-chats.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches all records from the chats table.
 * @returns An array of chats. The return type is inferred.
 */
export const getChats = async () => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("chats").select("*");

  if (error) {
    logError("Error fetching chats", error);
    throw new Error("Failed to fetch chats.");
  }

  return data || [];
};

// utils/mutations/messages/create-message.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert } from "@/database.types";

/**
 * Creates a new message in the database.
 * @param newData The data for the new message.
 * @returns The newly created message. The return type is inferred.
 */
export const createMessage = async (newData: TablesInsert<'messages'>) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating message", error);
    throw new Error("Failed to create message.");
  }

  return data;
};

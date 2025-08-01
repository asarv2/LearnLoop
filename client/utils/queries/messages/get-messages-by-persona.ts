// utils/queries/messages/get-messages-by-persona.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all messages related to a specific persona.
 * @param personaId The ID of the related persona.
 * @returns An array of messages.
 */
export const getMessagesByPersona = async (personaId: string): Promise<Tables<'messages'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("persona_id", personaId);

  if (error) {
    logError("Error fetching messages by persona", error);
    throw new Error("Failed to fetch messages.");
  }

  return data || [];
};

// utils/queries/messages/get-messages-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all messages related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of messages.
 */
export const getMessagesByTraining = async (trainingId: string): Promise<Tables<'messages'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching messages by training", error);
    throw new Error("Failed to fetch messages.");
  }

  return data || [];
};

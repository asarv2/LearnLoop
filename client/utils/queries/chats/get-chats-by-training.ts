// utils/queries/chats/get-chats-by-training.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all chats related to a specific training.
 * @param trainingId The ID of the related training.
 * @returns An array of chats.
 */
export const getChatsByTraining = async (trainingId: string): Promise<Tables<'chats'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("training_id", trainingId);

  if (error) {
    logError("Error fetching chats by training", error);
    throw new Error("Failed to fetch chats.");
  }

  return data || [];
};

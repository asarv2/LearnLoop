// utils/queries/chats/get-chats-by-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all chats related to a specific profile.
 * @param profileId The ID of the related profile.
 * @returns An array of chats.
 */
export const getChatsByProfile = async (profileId: string): Promise<Tables<'chats'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("profile_id", profileId);

  if (error) {
    logError("Error fetching chats by profile", error);
    throw new Error("Failed to fetch chats.");
  }

  return data || [];
};

// utils/queries/chats/get-chats-by-attempt.ts
"use server";

import type { Tables } from "@/database.types";
import { logError } from "@/utils/logger";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";

/**
 * Fetches all chats related to a specific attempt.
 * @param attemptId The ID of the related attempt.
 * @returns An array of chats.
 */
export const getChatsByAttempt = async (
  attemptId: string
): Promise<Tables<"chats">[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("attempt_id", attemptId)
    .order("created_at", { ascending: false });

  if (error) {
    logError("Error fetching chats by attempt", error);
    throw new Error("Failed to fetch chats.");
  }

  return data || [];
};

/**
 * Fetches all chats with optional filtering by attempt_id.
 * @param attemptId Optional attempt ID to filter by.
 * @returns An array of chats.
 */
export const getAllChats = async (
  attemptId?: string
): Promise<Tables<"chats">[]> => {
  const supabase = await supabaseServer(cookies());
  let query = supabase
    .from("chats")
    .select("*")
    .order("created_at", { ascending: false });

  if (attemptId) {
    query = query.eq("attempt_id", attemptId);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching chats", error);
    throw new Error("Failed to fetch chats.");
  }

  return data || [];
};

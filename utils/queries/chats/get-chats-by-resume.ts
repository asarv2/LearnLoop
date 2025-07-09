// utils/queries/chats/get-chats-by-resume.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";

/**
 * Fetches all chats related to a specific resume.
 * @param resumeId The ID of the related resume.
 * @returns An array of chats. The return type is inferred.
 */
export const getChatsByResume = async (resumeId: string) => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("resume_id", resumeId);

  if (error) {
    logError("Error fetching chats by resume", error);
    throw new Error("Failed to fetch chats.");
  }

  return data || [];
};

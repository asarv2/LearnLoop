// utils/queries/documents/get-documents-by-profile.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all documents related to a specific profile.
 * @param profileId The ID of the related profile.
 * @returns An array of documents.
 */
export const getDocumentsByProfile = async (profileId: string): Promise<Tables<'documents'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("profile_id", profileId);

  if (error) {
    logError("Error fetching documents by profile", error);
    throw new Error("Failed to fetch documents.");
  }

  return data || [];
};

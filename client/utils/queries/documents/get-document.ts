// utils/queries/documents/get-document.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches a single document by its primary key.
 * @param id The primary key of the document.
 * @returns The document object or null if not found.
 */
export const getDocument = async (id: string): Promise<Tables<'documents'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching document", error);
    throw new Error("Failed to fetch document.");
  }

  return data;
};

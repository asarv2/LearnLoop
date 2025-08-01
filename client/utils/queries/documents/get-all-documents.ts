// utils/queries/documents/get-all-documents.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all records from the documents table.
 * @returns An array of documents.
 */
export const getDocuments = async (): Promise<Tables<'documents'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase.from("documents").select("*");

  if (error) {
    logError("Error fetching documents", error);
    throw new Error("Failed to fetch documents.");
  }

  return data || [];
};

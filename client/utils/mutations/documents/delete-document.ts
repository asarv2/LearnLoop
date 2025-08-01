// utils/mutations/documents/delete-document.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Deletes a document from the database.
 * @param id The primary key of the document to delete.
 * @returns The deleted data.
 */
export const deleteDocument = async (id: string): Promise<Tables<'documents'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error deleting document", error);
    throw new Error("Failed to delete document.");
  }
  
  return data;
};

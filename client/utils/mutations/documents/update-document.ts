// utils/mutations/documents/update-document.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesUpdate, Tables } from "@/database.types";

/**
 * Updates an existing document.
 * @param id The primary key of the document to update.
 * @param updates The data to update.
 * @returns The updated document.
 */
export const updateDocument = async (id: string, updates: TablesUpdate<'documents'>): Promise<Tables<'documents'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    logError("Error updating document", error);
    throw new Error("Failed to update document.");
  }
  
  return data;
};

// utils/mutations/documents/create-document.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { TablesInsert, Tables } from "@/database.types";

/**
 * Creates a new document in the database.
 * @param newData The data for the new document.
 * @returns The newly created document.
 */
export const createDocument = async (newData: TablesInsert<'documents'>): Promise<Tables<'documents'>> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("documents")
    .insert(newData)
    .select()
    .single();

  if (error) {
    logError("Error creating document", error);
    throw new Error("Failed to create document.");
  }

  return data;
};

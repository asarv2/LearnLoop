// utils/queries/standards/get-standards-by-rubric.ts
"use server";

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "@/utils/logger";
import type { Tables } from "@/database.types";

/**
 * Fetches all standards related to a specific rubric.
 * @param rubricId The ID of the related rubric.
 * @returns An array of standards.
 */
export const getStandardsByRubric = async (rubricId: string): Promise<Tables<'standards'>[]> => {
  const supabase = await supabaseServer(cookies());
  const { data, error } = await supabase
    .from("standards")
    .select("*")
    .eq("rubric_id", rubricId);

  if (error) {
    logError("Error fetching standards by rubric", error);
    throw new Error("Failed to fetch standards.");
  }

  return data || [];
};

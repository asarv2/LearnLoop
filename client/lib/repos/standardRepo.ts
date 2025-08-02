// lib/repos/standardRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type StandardCreate =
  Database["public"]["Tables"]["standards"]["Insert"];
export type StandardUpdate =
  Database["public"]["Tables"]["standards"]["Update"];
export type StandardGrade =
  Database["public"]["Tables"]["standard_grades"]["Row"];

// Runtime validators for API requests
export const StandardCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  items: z.array(z.string()).nullable().optional(),
  rubric_id: z.string().nullable().optional(),
});

export const StandardUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().nullable().optional(),
  items: z.array(z.string()).nullable().optional(),
  rubric_id: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const standardRepo = {
  async create(payload: StandardCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("standards")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("standards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("standards")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Standard with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: StandardUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("standards")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Standard with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("standards").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Standard with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },

  async getGrades(standardId: string): Promise<StandardGrade[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("standard_grades")
      .select("*")
      .eq("standard_id", standardId)
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data;
  },
};

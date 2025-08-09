// lib/repos/rubricRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type RubricCreate = Database["public"]["Tables"]["rubrics"]["Insert"];
export type RubricUpdate = Database["public"]["Tables"]["rubrics"]["Update"];
export type RubricGrade = Database["public"]["Tables"]["rubric_grades"]["Row"];

// Runtime validators for API requests
export const RubricCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  standard_length: z.number().nullable().optional(),
  total_points: z.number().nullable().optional(),
});

export const RubricUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().nullable().optional(),
  standard_length: z.number().nullable().optional(),
  total_points: z.number().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const rubricRepo = {
  async create(payload: RubricCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("rubrics")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("rubrics")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("rubrics")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Rubric with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: RubricUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("rubrics")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Rubric with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("rubrics").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Rubric with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },

  async getGrades(rubricId: string): Promise<RubricGrade[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("rubric_grades")
      .select("*, standard_grades(*)")
      .eq("rubric_id", rubricId)
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async getAllGrades(): Promise<RubricGrade[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("rubric_grades")
      .select("*, standard_grades(*)")
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data;
  },
};

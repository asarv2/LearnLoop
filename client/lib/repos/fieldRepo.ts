// lib/repos/fieldRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type FieldCreate = Database["public"]["Tables"]["fields"]["Insert"];
export type FieldUpdate = Database["public"]["Tables"]["fields"]["Update"];

// Runtime validators for API requests
export const FieldCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  field_type: z.enum([
    "persona",
    "document",
    "numerical",
    "categorical",
    "text",
  ]),
  hidden: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

export const FieldUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  field_type: z
    .enum(["persona", "document", "numerical", "categorical", "text"])
    .optional(),
  hidden: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const fieldRepo = {
  async create(payload: FieldCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("fields")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("fields")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("fields")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Field with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: FieldUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("fields")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Field with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("fields").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Field with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

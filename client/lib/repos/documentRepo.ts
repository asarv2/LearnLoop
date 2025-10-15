// lib/repos/documentRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type DocumentCreate =
  Database["public"]["Tables"]["documents"]["Insert"];
export type DocumentUpdate =
  Database["public"]["Tables"]["documents"]["Update"];

// Runtime validators for API requests
export const DocumentCreateSchema = z.object({
  content: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});

export const DocumentUpdateSchema = z.object({
  content: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer();
}

// CRUD wrappers
export const documentRepo = {
  async create(payload: DocumentCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("documents")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Document with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: DocumentUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("documents")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Document with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Document with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

// lib/repos/policyRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type PolicyCreate = Database["public"]["Tables"]["policies"]["Insert"];
export type PolicyUpdate = Database["public"]["Tables"]["policies"]["Update"];

export const PolicyCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  file_key: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  company: z.string().min(1),
});

export const PolicyUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  file_key: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  company: z.string().min(1).optional(),
});

async function getSupabase() {
  return await supabaseServer();
}

export const policyRepo = {
  async create(payload: PolicyCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("policies")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("policies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("policies")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Policy with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: PolicyUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("policies")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Policy with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("policies").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Policy with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

// lib/repos/profileRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { z } from "zod";

export type ProfileCreate = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

// Runtime validators for API requests
export const ProfileCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  active: z.boolean().nullable().optional(),
  last_active: z.string().datetime().nullable().optional(),
  role: z.enum(["employee", "admin", "superadmin"]).nullable().optional(),
  viewed_intro: z.boolean().optional(),
  company: z.string().nullable().optional(),
  created_at: z.string().datetime().nullable().optional(),
  updated_at: z.string().datetime().nullable().optional(),
});

export const ProfileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  active: z.boolean().nullable().optional(),
  last_active: z.string().datetime().nullable().optional(),
  role: z.enum(["employee", "admin", "superadmin"]).nullable().optional(),
  viewed_intro: z.boolean().optional(),
  company: z.string().nullable().optional(),
  created_at: z.string().datetime().nullable().optional(),
  updated_at: z.string().datetime().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer();
}

// CRUD wrappers
export const profileRepo = {
  async create(payload: ProfileCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Profile with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: ProfileUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Profile with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Profile with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

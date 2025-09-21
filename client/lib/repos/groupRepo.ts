// lib/repos/groupRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type GroupCreate = Database["public"]["Tables"]["groups"]["Insert"];
export type GroupUpdate = Database["public"]["Tables"]["groups"]["Update"];

// Runtime validators for API requests
export const GroupCreateSchema = z.object({
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  persona_field_id: z.string().nullable().optional(),
  position_field_id: z.string().nullable().optional(),
  level_field_id: z.string().nullable().optional(),
  mood_field_id: z.string().nullable().optional(),
});

export const GroupUpdateSchema = z.object({
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  persona_field_id: z.string().nullable().optional(),
  position_field_id: z.string().nullable().optional(),
  level_field_id: z.string().nullable().optional(),
  mood_field_id: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const groupRepo = {
  async create(payload: GroupCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("groups")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Group with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: GroupUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("groups")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Group with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Group with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

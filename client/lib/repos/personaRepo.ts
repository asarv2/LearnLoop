// lib/repos/personaRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type PersonaCreate = Database["public"]["Tables"]["personas"]["Insert"];
export type PersonaUpdate = Database["public"]["Tables"]["personas"]["Update"];

// Runtime validators for API requests
export const PersonaCreateSchema = z.object({
  profile_id: z.string().min(1, "Profile ID is required").nullable().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
  realtime_prompt: z.string().optional(),
  temperature: z.number().optional(),
  voice: z.string().optional(),
  avatar_url: z.string().optional(),
  metadata: z.any().optional(), // Json type
  active: z.boolean().optional(),
  parent_id: z.string().nullable().optional(),
  level: z.enum(["junior", "mid", "senior", "executive"]).nullable().optional(),
  position: z.string().nullable().optional(),
});

export const PersonaUpdateSchema = z.object({
  profile_id: z.string().min(1, "Profile ID is required").nullable().optional(),
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
  realtime_prompt: z.string().optional(),
  temperature: z.number().optional(),
  voice: z.string().optional(),
  avatar_url: z.string().optional(),
  metadata: z.any().optional(), // Json type
  active: z.boolean().optional(),
  parent_id: z.string().nullable().optional(),
  level: z.enum(["junior", "mid", "senior", "executive"]).nullable().optional(),
  position: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// 3.2 – CRUD wrappers
export const personaRepo = {
  async create(payload: PersonaCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("personas")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list(profileId?: string | null) {
    const supabase = await getSupabase();
    let query = supabase.from("personas").select("*");

    if (profileId !== undefined && profileId !== null) {
      query = query.eq("profile_id", profileId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("personas")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Persona with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: PersonaUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("personas")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Persona with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("personas").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Persona with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

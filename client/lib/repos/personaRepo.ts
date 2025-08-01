// lib/repos/personaRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type PersonaCreate = Database['public']['Tables']['personas']['Insert'];
export type PersonaUpdate = Database['public']['Tables']['personas']['Update'];

// Runtime validators for API requests
export const PersonaCreateSchema = z.object({
  profile_id: z.string().min(1, "Profile ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  avatar_url: z.string().optional(),
  metadata: z.any().optional(), // Json type
});

export const PersonaUpdateSchema = z.object({
  profile_id: z.string().min(1, "Profile ID is required").optional(),
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  avatar_url: z.string().optional(),
  metadata: z.any().optional(), // Json type
});

const supabase = await supabaseServer(cookies());

// 3.2 – CRUD wrappers
export const personaRepo = {
  async create(payload: PersonaCreate) {
    const { data, error } = await supabase
      .from('personas')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const { data, error } = await supabase.from('personas').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const { data, error } = await supabase.from('personas').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Persona with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: PersonaUpdate) {
    const { data, error } = await supabase.from('personas').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Persona with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('personas').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Persona with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
}; 
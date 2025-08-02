// lib/repos/parameterRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type ParameterCreate = Database['public']['Tables']['parameters']['Insert'];
export type ParameterUpdate = Database['public']['Tables']['parameters']['Update'];

// Runtime validators for API requests
export const ParameterCreateSchema = z.object({
  field_id: z.string().min(1, "Field ID is required"),
  name: z.string().min(1, "Name is required"),
  value: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
});

export const ParameterUpdateSchema = z.object({
  field_id: z.string().min(1, "Field ID is required").optional(),
  name: z.string().min(1, "Name is required").optional(),
  value: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// 3.2 – CRUD wrappers
export const parameterRepo = {
  async create(payload: ParameterCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('parameters')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('parameters').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('parameters').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Parameter with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: ParameterUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('parameters').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Parameter with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from('parameters').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Parameter with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
}; 
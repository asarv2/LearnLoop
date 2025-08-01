// lib/repos/hintRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type HintCreate = Database['public']['Tables']['hints']['Insert'];
export type HintUpdate = Database['public']['Tables']['hints']['Update'];

// Runtime validators for API requests
export const HintCreateSchema = z.object({
  contents: z.array(z.string()).nullable().optional(),
  message_id: z.string().nullable().optional(),
});

export const HintUpdateSchema = z.object({
  contents: z.array(z.string()).nullable().optional(),
  message_id: z.string().nullable().optional(),
});

const supabase = await supabaseServer(cookies());

// CRUD wrappers
export const hintRepo = {
  async create(payload: HintCreate) {
    const { data, error } = await supabase
      .from('hints')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const { data, error } = await supabase.from('hints').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const { data, error } = await supabase.from('hints').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Hint with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: HintUpdate) {
    const { data, error } = await supabase.from('hints').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Hint with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('hints').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Hint with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
}; 
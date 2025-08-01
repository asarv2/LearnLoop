// lib/repos/documentRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type DocumentCreate = Database['public']['Tables']['documents']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

// Runtime validators for API requests
export const DocumentCreateSchema = z.object({
  content: z.string().nullable().optional(),
  google_file_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
});

export const DocumentUpdateSchema = z.object({
  content: z.string().nullable().optional(),
  google_file_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
});

const supabase = await supabaseServer(cookies());

// CRUD wrappers
export const documentRepo = {
  async create(payload: DocumentCreate) {
    const { data, error } = await supabase
      .from('documents')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Document with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: DocumentUpdate) {
    const { data, error } = await supabase.from('documents').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Document with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Document with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
}; 
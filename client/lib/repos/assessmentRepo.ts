// lib/repos/assessmentRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type AssessmentCreate = Database['public']['Tables']['assessments']['Insert'];
export type AssessmentUpdate = Database['public']['Tables']['assessments']['Update'];

// Runtime validators for API requests
export const AssessmentCreateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required"),
  title: z.string().min(1, "Title is required").optional(),
  responses: z.any().optional(), // Json type
  training_id: z.string().nullable().optional(),
});

export const AssessmentUpdateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required").optional(),
  title: z.string().min(1, "Title is required").optional(),
  responses: z.any().optional(), // Json type
  training_id: z.string().nullable().optional(),
});

const supabase = await supabaseServer(cookies());

// 3.2 – CRUD wrappers
export const assessmentRepo = {
  async create(payload: AssessmentCreate) {
    const { data, error } = await supabase
      .from('assessments')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const { data, error } = await supabase.from('assessments').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const { data, error } = await supabase.from('assessments').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Assessment with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: AssessmentUpdate) {
    const { data, error } = await supabase.from('assessments').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Assessment with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Assessment with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
};

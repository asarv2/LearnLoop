// lib/repos/feedbackRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type FeedbackCreate = Database['public']['Tables']['feedback']['Insert'];
export type FeedbackUpdate = Database['public']['Tables']['feedback']['Update'];

// Runtime validators for API requests
export const FeedbackCreateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required"),
  errors: z.array(z.string()).optional(),
  green_flags: z.array(z.string()).optional(),
  red_flags: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).nullable().optional(),
  training_id: z.string().nullable().optional(),
});

export const FeedbackUpdateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required").optional(),
  errors: z.array(z.string()).optional(),
  green_flags: z.array(z.string()).optional(),
  red_flags: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).nullable().optional(),
  training_id: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const feedbackRepo = {
  async create(payload: FeedbackCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('feedback')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('feedback').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Feedback with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: FeedbackUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('feedback').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Feedback with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from('feedback').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Feedback with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
}; 
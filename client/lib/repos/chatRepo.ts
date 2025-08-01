// lib/repos/chatRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type ChatCreate = Database['public']['Tables']['chats']['Insert'];
export type ChatUpdate = Database['public']['Tables']['chats']['Update'];

// Runtime validators for API requests
export const ChatCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  name: z.string().optional(),
  position: z.string().optional(),
  type: z.enum(["regular", "cheating", "ai-assisted", "preparation"]),
  voice: z.string().optional(),
  additional_info: z.string().optional(),
  attempt_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  resume_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
  training_type: z.enum(["interview", "offboarding", "preparation"]).nullable().optional(),
  user_id: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  feedback: z.any().optional(), // Json type
});

export const ChatUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  name: z.string().optional(),
  position: z.string().optional(),
  type: z.enum(["regular", "cheating", "ai-assisted", "preparation"]).optional(),
  voice: z.string().optional(),
  additional_info: z.string().optional(),
  attempt_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  resume_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
  training_type: z.enum(["interview", "offboarding", "preparation"]).nullable().optional(),
  user_id: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  feedback: z.any().optional(), // Json type
});

const supabase = await supabaseServer(cookies());

// CRUD wrappers
export const chatRepo = {
  async create(payload: ChatCreate) {
    const { data, error } = await supabase
      .from('chats')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const { data, error } = await supabase.from('chats').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const { data, error } = await supabase.from('chats').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: ChatUpdate) {
    const { data, error } = await supabase.from('chats').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('chats').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
}; 
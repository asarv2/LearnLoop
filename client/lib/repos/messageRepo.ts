// lib/repos/messageRepo.ts
import { cookies } from "next/headers";
import { z } from "zod";
import supabaseServer from "@/utils/supabase/supabase-server";
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";

export type MessageCreate = Database['public']['Tables']['messages']['Insert'];
export type MessageUpdate = Database['public']['Tables']['messages']['Update'];

// Runtime validators for API requests
export const MessageCreateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required"),
  content: z.string().min(1, "Content is required"),
  role: z.enum(['user', 'assistant']).optional(),
  metadata: z.any().optional(), // Json type
});

export const MessageUpdateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required").optional(),
  content: z.string().min(1, "Content is required").optional(),
  role: z.enum(['user', 'assistant']).optional(),
  metadata: z.any().optional(), // Json type
});

const supabase = await supabaseServer(cookies());

// 3.2 – CRUD wrappers
export const messageRepo = {
  async create(payload: MessageCreate) {
    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const { data, error } = await supabase.from('messages').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Message with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: MessageUpdate) {
    const { data, error } = await supabase.from('messages').update(patch).eq('id', id).select().single();
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Message with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') {
        throw HttpError.notFound(`Message with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  }
}; 
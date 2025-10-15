// lib/repos/messageRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { z } from "zod";

export type MessageCreate = Database["public"]["Tables"]["messages"]["Insert"];
export type MessageUpdate = Database["public"]["Tables"]["messages"]["Update"];
export type MessageHint = Database["public"]["Tables"]["hints"]["Row"];

// Runtime validators for API requests
export const MessageCreateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required"),
  content: z.string().min(1, "Content is required"),
  role: z.enum(["user", "assistant"]).optional(),
  metadata: z.any().optional(), // Json type
  word_timestamps: z
    .array(
      z.object({
        start_ms: z.number().int().nonnegative().optional(),
        end_ms: z.number().int().nonnegative().optional(),
        text: z.string().optional(),
      })
    )
    .optional(),
});

export const MessageUpdateSchema = z.object({
  chat_id: z.string().min(1, "Chat ID is required").optional(),
  content: z.string().min(1, "Content is required").optional(),
  role: z.enum(["user", "assistant"]).optional(),
  metadata: z.any().optional(), // Json type
  word_timestamps: z
    .array(
      z.object({
        start_ms: z.number().int().nonnegative().optional(),
        end_ms: z.number().int().nonnegative().optional(),
        text: z.string().optional(),
      })
    )
    .optional(),
});

async function getSupabase() {
  return await supabaseServer();
}

// 3.2 – CRUD wrappers
export const messageRepo = {
  async create(payload: MessageCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async listByChatId(chatId: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Message with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: MessageUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Message with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Message with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },

  async getHints(messageId: string): Promise<MessageHint[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("hints")
      .select("*")
      .eq("message_id", messageId)
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data;
  },
};

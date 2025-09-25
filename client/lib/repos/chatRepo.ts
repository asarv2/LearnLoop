// lib/repos/chatRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type ChatCreate = Database["public"]["Tables"]["chats"]["Insert"];
export type ChatUpdate = Database["public"]["Tables"]["chats"]["Update"];

// Base chat type
type ChatRow = Database["public"]["Tables"]["chats"]["Row"];

// Related table types
type RubricGradeRow = Database["public"]["Tables"]["rubric_grades"]["Row"];
type StandardGradeRow = Database["public"]["Tables"]["standard_grades"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type HintRow = Database["public"]["Tables"]["hints"]["Row"];

// Simplified chat type with all includes
export type ChatWithAllIncludes = ChatRow & {
  rubric_grades: (RubricGradeRow & {
    standard_grades: StandardGradeRow[];
  })[];
  messages: (MessageRow & {
    hints: HintRow[];
  })[];
};

// Runtime validators for API requests - Updated to match database schema
export const ChatCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  voice: z.string().optional(),
  attempt_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
  parameter_ids: z.array(z.string()).nullable().optional(),
  completed: z.boolean().optional(),
  completed_at: z.string().nullable().optional(),
  trace_id: z.string().nullable().optional(),
});

export const ChatUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().nullable().optional(),
  voice: z.string().optional(),
  attempt_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
  parameter_ids: z.array(z.string()).nullable().optional(),
  completed: z.boolean().optional(),
  completed_at: z.string().nullable().optional(),
  trace_id: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const chatRepo = {
  async create(payload: ChatCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("chats")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list(profileId?: string) {
    const supabase = await getSupabase();
    let query = supabase.from("chats").select("*");

    // Filter by profile_id if provided
    if (profileId) {
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
      .from("chats")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async fetchChat(id: string): Promise<ChatWithAllIncludes> {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("chats")
      .select(
        `
        *,
        rubric_grades(*, standard_grades(*)),
        messages(*, hints(*))
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data as ChatWithAllIncludes;
  },

  async update(id: string, patch: ChatUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("chats")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("chats").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

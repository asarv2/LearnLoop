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
type AssessmentRow = Database["public"]["Tables"]["assessments"]["Row"];
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type FeedbackRow = Database["public"]["Tables"]["feedback"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type HintRow = Database["public"]["Tables"]["hints"]["Row"];

// Simplified chat type with all includes
export type ChatWithAllIncludes = ChatRow & {
  rubric_grades: (RubricGradeRow & {
    standard_grades: StandardGradeRow[];
  })[];
  assessments: (AssessmentRow & {
    questions: QuestionRow[];
  })[];
  feedback: FeedbackRow[];
  messages: (MessageRow & {
    hints: HintRow[];
  })[];
};

// Runtime validators for API requests
export const ChatCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  name: z.string().optional(),
  position: z.string().optional(),
  type: z.enum(["regular", "cheating", "ai-assisted"]),
  voice: z.string().optional(),
  additional_info: z.string().optional(),
  attempt_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  resume_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
  training_type: z
    .enum(["interview", "offboarding"])
    .nullable()
    .optional(),
  user_id: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  feedback: z.any().optional(), // Json type
  parameter_ids: z.array(z.string()).nullable().optional(),
});

export const ChatUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  name: z.string().optional(),
  position: z.string().optional(),
  type: z
    .enum(["regular", "cheating", "ai-assisted"])
    .optional(),
  voice: z.string().optional(),
  additional_info: z.string().optional(),
  attempt_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  resume_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
  training_type: z
    .enum(["interview", "offboarding"])
    .nullable()
    .optional(),
  user_id: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  feedback: z.any().optional(), // Json type
  parameter_ids: z.array(z.string()).nullable().optional(),
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

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .order("created_at", { ascending: false });
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
        assessments(*, questions(*)),
        feedback(*),
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

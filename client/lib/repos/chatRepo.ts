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

// Union type for all possible includes
export type ChatIncludes =
  | "grades"
  | "assessment"
  | "feedback"
  | "hints"
  | "messages";

// Type mapping for includes
type IncludeMap = {
  grades: {
    rubric_grades: (RubricGradeRow & {
      standard_grades: StandardGradeRow[];
    })[];
  };
  assessment: {
    assessments: (AssessmentRow & {
      questions: QuestionRow[];
    })[];
  };
  feedback: {
    feedback: FeedbackRow[];
  };
  hints: {
    messages: (MessageRow & {
      hints: HintRow[];
    })[];
  };
  messages: {
    messages: MessageRow[];
  };
};

// Helper type to check if a type is never
type IsNever<T> = [T] extends [never] ? true : false;

// Conditional type that builds the return type based on includes
export type ChatWithIncludes<T extends ChatIncludes[]> = ChatRow &
  (T extends [infer First, ...infer Rest]
    ? First extends ChatIncludes
      ? Rest extends ChatIncludes[]
        ? IsNever<Rest> extends true
          ? IncludeMap[First]
          : IncludeMap[First] & ChatWithIncludes<Rest>
        : IncludeMap[First]
      : Record<string, never>
    : Record<string, never>);

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
  training_type: z
    .enum(["interview", "offboarding", "preparation"])
    .nullable()
    .optional(),
  user_id: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  feedback: z.any().optional(), // Json type
});

export const ChatUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  name: z.string().optional(),
  position: z.string().optional(),
  type: z
    .enum(["regular", "cheating", "ai-assisted", "preparation"])
    .optional(),
  voice: z.string().optional(),
  additional_info: z.string().optional(),
  attempt_id: z.string().nullable().optional(),
  profile_id: z.string().nullable().optional(),
  resume_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
  training_type: z
    .enum(["interview", "offboarding", "preparation"])
    .nullable()
    .optional(),
  user_id: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  feedback: z.any().optional(), // Json type
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

  async fetchChat<T extends ChatIncludes[]>(
    id: string,
    includes: T = [] as unknown as T
  ): Promise<ChatWithIncludes<T>> {
    const supabase = await getSupabase();
    /* Build a dynamic SELECT clause */
    const selectors = ["*"]; // ← base chat columns

    if (includes.includes("grades" as ChatIncludes)) {
      selectors.push("rubric_grades(*, standard_grades(*))");
    }
    if (includes.includes("assessment" as ChatIncludes)) {
      selectors.push("assessments(*, questions(*))");
    }
    if (includes.includes("feedback" as ChatIncludes)) {
      selectors.push("feedback(*)");
    }
    if (includes.includes("hints" as ChatIncludes)) {
      selectors.push("messages(*, hints(*))");
    }
    if (includes.includes("messages" as ChatIncludes)) {
      selectors.push("messages(*)");
    }

    const { data, error } = await supabase
      .from("chats")
      .select(selectors.join(", "))
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Chat with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data as unknown as ChatWithIncludes<T>;
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

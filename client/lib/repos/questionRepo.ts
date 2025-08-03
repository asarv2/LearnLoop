// lib/repos/questionRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type QuestionCreate =
  Database["public"]["Tables"]["questions"]["Insert"];
export type QuestionUpdate =
  Database["public"]["Tables"]["questions"]["Update"];

// Runtime validators for API requests
export const QuestionCreateSchema = z.object({
  stem: z.string().min(1, "Question stem is required"),
  question_type: z.enum(["mcq", "frq"]),
  assessment_id: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  value: z.string().nullable().optional(),
});

export const QuestionUpdateSchema = z.object({
  stem: z.string().min(1, "Question stem is required").optional(),
  question_type: z.enum(["mcq", "frq"]).optional(),
  assessment_id: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  value: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const questionRepo = {
  async create(payload: QuestionCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("questions")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Question with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: QuestionUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("questions")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Question with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Question with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },

  async getByAssessmentId(assessmentId: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("default_question", { ascending: true }) // Non-default questions first
      .order("created_at", { ascending: true });

    if (error) throw new HttpError(500, error.message);
    return data;
  },
};

// lib/repos/userFeedbackRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import { createApiClient } from "@/utils/supabase/supabase-api";
import { z } from "zod";

export type UserFeedbackCreate =
  Database["public"]["Tables"]["user_feedback"]["Insert"];
export type UserFeedbackUpdate =
  Database["public"]["Tables"]["user_feedback"]["Update"];

// Runtime validators for API requests
export const UserFeedbackCreateSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  feedback_text: z.string().min(1, "Feedback text is required"),
});

export const UserFeedbackUpdateSchema = z.object({
  user_id: z.string().min(1, "User ID is required").optional(),
  feedback_text: z.string().min(1, "Feedback text is required").optional(),
});

function getSupabase() {
  return createApiClient(); // Use API client with service role that bypasses RLS
}

// CRUD wrappers
export const userFeedbackRepo = {
  async create(payload: UserFeedbackCreate) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_feedback")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`User feedback with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: UserFeedbackUpdate) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("user_feedback")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`User feedback with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("user_feedback")
      .delete()
      .eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`User feedback with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

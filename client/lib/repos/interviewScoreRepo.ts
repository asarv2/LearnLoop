// lib/repos/interviewScoreRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";

export type InterviewScoreCreate =
  Database["public"]["Tables"]["interview_scores"]["Insert"];
export type InterviewScoreUpdate =
  Database["public"]["Tables"]["interview_scores"]["Update"];

async function getSupabase() {
  return await supabaseServer(cookies());
}

export const interviewScoreRepo = {
  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("interview_scores")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async create(payload: InterviewScoreCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("interview_scores")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("interview_scores")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async update(id: string, patch: InterviewScoreUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("interview_scores")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("interview_scores")
      .delete()
      .eq("id", id);
    if (error) throw new HttpError(500, error.message);
  },
};

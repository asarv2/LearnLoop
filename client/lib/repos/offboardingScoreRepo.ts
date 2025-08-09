// lib/repos/offboardingScoreRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";

export type OffboardingScoreCreate =
  Database["public"]["Tables"]["offboarding_scores"]["Insert"];
export type OffboardingScoreUpdate =
  Database["public"]["Tables"]["offboarding_scores"]["Update"];

async function getSupabase() {
  return await supabaseServer(cookies());
}

export const offboardingScoreRepo = {
  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("offboarding_scores")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async create(payload: OffboardingScoreCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("offboarding_scores")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("offboarding_scores")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async update(id: string, patch: OffboardingScoreUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("offboarding_scores")
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
      .from("offboarding_scores")
      .delete()
      .eq("id", id);
    if (error) throw new HttpError(500, error.message);
  },
};

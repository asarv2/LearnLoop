// lib/repos/scenarioRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type ScenarioCreate =
  Database["public"]["Tables"]["scenarios"]["Insert"];
export type ScenarioUpdate =
  Database["public"]["Tables"]["scenarios"]["Update"];

// Runtime validators for API requests
export const ScenarioCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  parameter_ids: z.array(z.string()).nullable().optional(),
  rubric_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
});

export const ScenarioUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().nullable().optional(),
  parameter_ids: z.array(z.string()).nullable().optional(),
  rubric_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const scenarioRepo = {
  async create(payload: ScenarioCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("scenarios")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("scenarios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async listByTrainingId(trainingId: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("scenarios")
      .select("*")
      .eq("training_id", trainingId)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("scenarios")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Scenario with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: ScenarioUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("scenarios")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Scenario with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("scenarios").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Scenario with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

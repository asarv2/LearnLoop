// lib/repos/trainingRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type TrainingCreate =
  Database["public"]["Tables"]["trainings"]["Insert"];
export type TrainingUpdate =
  Database["public"]["Tables"]["trainings"]["Update"];

// Base training type
type TrainingRow = Database["public"]["Tables"]["trainings"]["Row"];

// Related table types
type ScenarioRow = Database["public"]["Tables"]["scenarios"]["Row"];
type RubricRow = Database["public"]["Tables"]["rubrics"]["Row"];
type StandardRow = Database["public"]["Tables"]["standards"]["Row"];

// Simplified training type with all includes
export type TrainingWithAllIncludes = TrainingRow & {
  scenarios: (ScenarioRow & {
    rubrics: (RubricRow & {
      standards: StandardRow[];
    })[];
  })[];
};

// Runtime validators for API requests
export const TrainingCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  what_to_do: z.array(z.string()).optional(),
  what_not_to_do: z.array(z.string()).optional(),
  active: z.boolean().default(false),
  practice: z.boolean().default(false),
  type: z.string().min(1, "Type is required"),
});

export const TrainingUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  what_to_do: z.array(z.string()).optional(),
  what_not_to_do: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  practice: z.boolean().optional(),
  type: z.string().min(1, "Type is required").optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const trainingRepo = {
  async create(payload: TrainingCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("trainings")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async listPractice() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .eq("practice", true)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Training with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async fetchTraining(id: string): Promise<TrainingWithAllIncludes> {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("trainings")
      .select(
        `
        *,
        scenarios(*, rubrics(*, standards(*)))
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Training with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data as unknown as TrainingWithAllIncludes;
  },

  async update(id: string, patch: TrainingUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("trainings")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Training with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("trainings").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Training with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

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

// Runtime validators for API requests - Updated to match database schema
export const TrainingCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  what_to_do: z.array(z.string()).nullable().optional(),
  what_not_to_do: z.array(z.string()).nullable().optional(),
  active: z.boolean().nullable().optional(),
  practice: z.boolean().optional(),
  show_documents: z.boolean().optional(),
  training_type: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  due_date: z.string().datetime().nullable().optional(),
  company: z.string().nullable().optional(),
});

export const TrainingUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().nullable().optional(),
  what_to_do: z.array(z.string()).nullable().optional(),
  what_not_to_do: z.array(z.string()).nullable().optional(),
  active: z.boolean().nullable().optional(),
  practice: z.boolean().optional(),
  show_documents: z.boolean().optional(),
  training_type: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  due_date: z.string().datetime().nullable().optional(),
  company: z.string().nullable().optional(),
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

  async listByType(type: "standard" | "required" | "custom") {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .eq("training_type", type)
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async listByTypeAndCompany(
    type: "standard" | "required" | "custom",
    company: string | null
  ) {
    const supabase = await getSupabase();
    let query = supabase
      .from("trainings")
      .select("*")
      .eq("training_type", type);

    if (company) {
      query = query.or(`company.eq.${company},company.is.null`);
    } else {
      query = query.is("company", null);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async listCustomForUser(userId: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("trainings")
      .select("*")
      .eq("training_type", "custom")
      .eq("user_id", userId)
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

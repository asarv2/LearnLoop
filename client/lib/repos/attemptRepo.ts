// lib/repos/attemptRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type AttemptCreate = Database["public"]["Tables"]["attempts"]["Insert"];
export type AttemptUpdate = Database["public"]["Tables"]["attempts"]["Update"];

// Runtime validators for API requests
export const AttemptCreateSchema = z.object({
  profile_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
});

export const AttemptUpdateSchema = z.object({
  profile_id: z.string().nullable().optional(),
  training_id: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer();
}

// CRUD wrappers
export const attemptRepo = {
  async create(payload: AttemptCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("attempts")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list(profileId?: string) {
    const supabase = await getSupabase();
    let query = supabase.from("attempts").select("*");

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
      .from("attempts")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Attempt with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: AttemptUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("attempts")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Attempt with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("attempts").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Attempt with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

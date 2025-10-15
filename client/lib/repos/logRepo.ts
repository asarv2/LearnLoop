// lib/repos/logRepo.ts
import type { Database } from "@/database.types";
import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";
import { z } from "zod";

export type LogCreate = Database["public"]["Tables"]["logs"]["Insert"];
export type LogUpdate = Database["public"]["Tables"]["logs"]["Update"];

// Runtime validators for API requests
export const LogCreateSchema = z.object({
  level: z.enum(["info", "error", "warn", "debug"]),
  message: z.string().min(1, "Message is required"),
  training_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
});

export const LogUpdateSchema = z.object({
  level: z.enum(["info", "error", "warn", "debug"]).optional(),
  message: z.string().min(1, "Message is required").optional(),
  training_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
});

async function getSupabase() {
  return await supabaseServer(cookies());
}

// CRUD wrappers
export const logRepo = {
  async create(payload: LogCreate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("logs")
      .insert(payload)
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async find(id: string) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Log with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async update(id: string, patch: LogUpdate) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("logs")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Log with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: string) {
    const supabase = await getSupabase();
    const { error } = await supabase.from("logs").delete().eq("id", id);
    if (error) {
      if (error.code === "PGRST116") {
        throw HttpError.notFound(`Log with id ${id} not found`);
      }
      throw new HttpError(500, error.message);
    }
  },
};

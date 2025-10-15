import { HttpError } from "@/utils/HttpError";
import supabaseServer from "@/utils/supabase/supabase-server";
import { z } from "zod";

export const ContactMessageCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  company: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

export const ContactMessageUpdateSchema = z.object({
  status: z.enum(["pending", "responded", "closed"]).optional(),
});

export type ContactMessageCreate = z.infer<typeof ContactMessageCreateSchema>;
export type ContactMessageUpdate = z.infer<typeof ContactMessageUpdateSchema>;

async function getSupabase() {
  return await supabaseServer();
}

export const contactMessageRepo = {
  async create(payload: ContactMessageCreate) {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("contact_messages")
      .insert({
        name: payload.name,
        email: payload.email,
        company: payload.company || null,
        subject: payload.subject,
        message: payload.message,
      })
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async list() {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async getById(id: string) {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async update(id: string, payload: ContactMessageUpdate) {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("contact_messages")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async delete(id: string) {
    const supabase = await getSupabase();

    const { error } = await supabase
      .from("contact_messages")
      .delete()
      .eq("id", id);

    if (error) throw new HttpError(500, error.message);
    return { success: true };
  },
};

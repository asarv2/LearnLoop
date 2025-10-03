import supabaseServer from "@/utils/supabase/supabase-server";
import { cookies } from "next/headers";

export const supabaseAdapter = {
  async getSignedUrl(key: string, expiresIn: number) {
    const supabase = await supabaseServer(cookies());
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(key, expiresIn);
    if (error) throw new Error(error.message);
    if (!data?.signedUrl) throw new Error("Failed to create signed URL");
    return data.signedUrl;
  },

  async getSignedUrlAudio(key: string, expiresIn: number) {
    const supabase = await supabaseServer(cookies());
    // Try audio bucket first, fall back to documents bucket
    const { data, error } = await supabase.storage
      .from("audio")
      .createSignedUrl(key, expiresIn);

    if (error) {
      // Fall back to documents bucket if audio bucket doesn't exist
      const documentsResult = await supabase.storage
        .from("documents")
        .createSignedUrl(key, expiresIn);

      if (documentsResult.error) throw new Error(documentsResult.error.message);
      if (!documentsResult.data?.signedUrl)
        throw new Error("Failed to create signed URL");
      return documentsResult.data.signedUrl;
    }

    if (!data?.signedUrl) throw new Error("Failed to create signed URL");
    return data.signedUrl;
  },

  async uploadFile(file: File, key: string) {
    const supabase = await supabaseServer(cookies());
    const { error } = await supabase.storage
      .from("documents")
      .upload(key, file, {
        cacheControl: "3600",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    return key;
  },

  async uploadFileAudio(file: File, key: string) {
    const supabase = await supabaseServer(cookies());
    // Try audio bucket first, fall back to documents bucket
    const { error } = await supabase.storage.from("audio").upload(key, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      // Fall back to documents bucket if audio bucket doesn't exist
      const documentsResult = await supabase.storage
        .from("documents")
        .upload(key, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (documentsResult.error) throw new Error(documentsResult.error.message);
      return key;
    }

    return key;
  },
};

// utils/storage/upload-resume-to-supabase.ts
// Uploads a resume to supabase

import { cookies } from "next/headers";
import supabaseServer from "@/utils/supabase/supabase-server";
import { logError } from "../logger";

export const uploadResumeToSupabase = async (resumeId: string, formData: FormData) => {
    const supabase = await supabaseServer(cookies());
    const resume = formData.get("resume") as File;
    const { error } = await supabase.storage
        .from("resumes")
        .upload(`${resumeId}.pdf`, resume, {
            cacheControl: "3600",
            upsert: false,
        });

    if (error) {
        logError("Error uploading resume to supabase", error);
        throw new Error("Failed to upload resume to supabase.");
    }
}
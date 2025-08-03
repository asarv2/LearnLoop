// utils/storage/upload-document.ts
// Uploads a document to storage (supports both R2 and Supabase)

import { storage } from "@/lib/storage";
import { logError } from "../logger";

export const uploadDocument = async (
  documentId: string,
  formData: FormData
) => {
  try {
    const file = formData.get("document") as File;

    // Validate file type
    if (!file || file.type !== "application/pdf") {
      throw new Error("Only PDF files are allowed");
    }

    // Validate file size (e.g., 10MB limit)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      throw new Error("File size must be less than 10MB");
    }

    const key = `${documentId}.pdf`;
    await storage.uploadFile(file, key);

    return key;
  } catch (error) {
    await logError("Error uploading document", error, { documentId });
    throw error;
  }
};

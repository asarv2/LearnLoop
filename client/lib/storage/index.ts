export interface StorageAdapter {
  /** Return a time-limited, publicly readable URL for `key` (e.g. "doc/abc.pdf") */
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
  /** Return a time-limited, publicly readable URL for audio file `key` (e.g. "audio/abc.wav") */
  getSignedUrlAudio(key: string, expiresIn: number): Promise<string>;
  /** Upload a file to storage and return the key */
  uploadFile(file: File, key: string): Promise<string>;
  /** Upload an audio file to storage and return the key */
  uploadFileAudio(file: File, key: string): Promise<string>;
}

/* Resolve at runtime based on ENV  */
import { r2Adapter } from "@/lib/storage/r2";
import { supabaseAdapter } from "@/lib/storage/supabase";

export const storage: StorageAdapter =
  process.env.STORAGE_DRIVER === "r2" ? r2Adapter : supabaseAdapter;

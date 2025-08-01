export interface StorageAdapter {
  /** Return a time-limited, publicly readable URL for `key` (e.g. "doc/abc.pdf") */
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}

/* Resolve at runtime based on ENV  */
import { supabaseAdapter } from '@/lib/storage/supabase';
import { r2Adapter } from '@/lib/storage/r2';

export const storage: StorageAdapter =
  process.env.STORAGE_DRIVER === 'r2' ? r2Adapter : supabaseAdapter; 
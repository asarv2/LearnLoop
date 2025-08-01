import supabaseServer from '@/utils/supabase/supabase-server';
import { cookies } from 'next/headers';

export const supabaseAdapter = {
  async getSignedUrl(key: string, expiresIn: number) {
    const supabase = await supabaseServer(cookies());
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(key, expiresIn);
    if (error) throw new Error(error.message);
    return data?.signedUrl!;
  },
}; 
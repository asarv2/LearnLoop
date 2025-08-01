import { createClient } from '@/utils/supabase/supabase-browser';
import { logError } from '@/utils/logger';

export async function getInterviewScore(chatId: string) {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('interview_scores')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No score found - this is expected for interviews without scores
        return null;
      }
      logError('Error fetching interview score:', error);
      throw new Error(`Failed to fetch interview score: ${error.message}`);
    }

    return data;
  } catch (error) {
    logError('Error in getInterviewScore:', error);
    throw error;
  }
} 
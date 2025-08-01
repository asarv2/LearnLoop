import { createClient } from '@/utils/supabase/supabase-browser';
import { logError } from '@/utils/logger';

export async function getAllInterviewScores(userId?: string, limit?: number) {
  try {
    const supabase = createClient();
    
    let query = supabase
      .from('interview_scores')
      .select(`
        *,
        chats (
          id,
          title,
          name,
          type,
          created_at,
          completed_at
        )
      `)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    // If userId is provided, filter by user's chats
    if (userId) {
      query = query.eq('chats.user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      logError('Error fetching interview scores:', error);
      throw new Error(`Failed to fetch interview scores: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    logError('Error in getAllInterviewScores:', error);
    throw error;
  }
}

export async function getScoreProgressData(userId?: string, days: number = 30) {
  try {
    const supabase = createClient();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let query = supabase
      .from('interview_scores')
      .select(`
        overall_score,
        question_quality,
        followup_skills,
        assessment_thoughtfulness,
        interview_conduct,
        communication_rapport,
        professional_judgment,
        created_at,
        chats (
          id,
          title,
          name
        )
      `)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true });

    // If userId is provided, filter by user's chats
    if (userId) {
      query = query.eq('chats.user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      logError('Error fetching score progress data:', error);
      throw new Error(`Failed to fetch score progress data: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    logError('Error in getScoreProgressData:', error);
    throw error;
  }
} 
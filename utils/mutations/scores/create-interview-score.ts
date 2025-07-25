import { createApiClient } from '@/utils/supabase/supabase-api';
import { logError } from '@/utils/logger';

export interface CreateInterviewScoreParams {
  chat_id: string;
  question_quality: number;
  followup_skills: number;
  assessment_thoughtfulness: number;
  interview_conduct: number;
  communication_rapport: number;
  professional_judgment: number;
  overall_score: number;
  category_feedback: {
    question_quality: string;
    followup_skills: string;
    assessment_thoughtfulness: string;
    interview_conduct: string;
    communication_rapport: string;
    professional_judgment: string;
  };
  overall_feedback: string;
  strengths: string[];
  improvement_areas: string[];
}

export async function createInterviewScore(params: CreateInterviewScoreParams) {
  try {
    const supabase = createApiClient();
    
    const { data, error } = await supabase
      .from('interview_scores')
      .insert([{
        chat_id: params.chat_id,
        question_quality: params.question_quality,
        followup_skills: params.followup_skills,
        assessment_thoughtfulness: params.assessment_thoughtfulness,
        interview_conduct: params.interview_conduct,
        communication_rapport: params.communication_rapport,
        professional_judgment: params.professional_judgment,
        overall_score: params.overall_score,
        category_feedback: params.category_feedback,
        overall_feedback: params.overall_feedback,
        strengths: params.strengths,
        improvement_areas: params.improvement_areas
      }])
      .select()
      .single();

    if (error) {
      logError('Error creating interview score:', error);
      throw new Error(`Failed to create interview score: ${error.message}`);
    }

    return data;
  } catch (error) {
    logError('Error in createInterviewScore:', error);
    throw error;
  }
} 
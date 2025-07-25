-- Create interview_scores table to track interviewer performance over time
CREATE TABLE interview_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    
    -- Individual category scores (1-5 scale)
    question_quality INTEGER NOT NULL CHECK (question_quality >= 1 AND question_quality <= 5),
    followup_skills INTEGER NOT NULL CHECK (followup_skills >= 1 AND followup_skills <= 5),
    assessment_thoughtfulness INTEGER NOT NULL CHECK (assessment_thoughtfulness >= 1 AND assessment_thoughtfulness <= 5),
    interview_conduct INTEGER NOT NULL CHECK (interview_conduct >= 1 AND interview_conduct <= 5),
    communication_rapport INTEGER NOT NULL CHECK (communication_rapport >= 1 AND communication_rapport <= 5),
    professional_judgment INTEGER NOT NULL CHECK (professional_judgment >= 1 AND professional_judgment <= 5),
    
    -- Overall score (1-100 scale)
    overall_score INTEGER NOT NULL CHECK (overall_score >= 1 AND overall_score <= 100),
    
    -- Detailed feedback for each category
    category_feedback JSONB NOT NULL DEFAULT '{}',
    
    -- Overall feedback and insights
    overall_feedback TEXT,
    strengths TEXT[] DEFAULT '{}',
    improvement_areas TEXT[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_interview_scores_chat_id ON interview_scores(chat_id);
CREATE INDEX idx_interview_scores_created_at ON interview_scores(created_at DESC);
CREATE INDEX idx_interview_scores_overall_score ON interview_scores(overall_score DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_interview_scores_updated_at 
    BEFORE UPDATE ON interview_scores 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Note: RLS policies omitted since chats table doesn't have user_id column
-- This appears to be a single-user application 
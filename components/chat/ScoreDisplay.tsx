import React from 'react';
import { Box, Flex, Text, Card } from '@radix-ui/themes';
import { Chat, InterviewScore, OffboardingScore } from '@/types';

interface ScoreDisplayProps {
  score: InterviewScore | OffboardingScore | null | undefined;
  chat?: Chat;
}

const interviewCategoryNames = {
  question_quality: 'Question Quality & Depth',
  followup_skills: 'Follow-up & Probing Skills',
  assessment_thoughtfulness: 'Assessment Thoughtfulness',
  interview_conduct: 'Interview Conduct & Flow',
  communication_rapport: 'Communication & Rapport',
  professional_judgment: 'Professional Judgment'
};

const offboardingCategoryNames = {
  empathy_emotional_intelligence: 'Empathy & Emotional Intelligence',
  communication_professionalism: 'Communication Clarity & Professionalism',
  clarity_of_next_steps: 'Clarity of Next Steps',
  transition_planning_logistics: 'Transition Planning & Logistics',
  conflict_resolution: 'Conflict Resolution & Difficult Conversations',
  assessment_thoughtfulness: 'Assessment Thoughtfulness & Reflection'
};

const PRIMARY_COLOR = '#2563eb'; // Strong blue for scores and highlights
const CARD_BG = 'rgba(30,41,59,0.04)'; // Subtle blue-gray for cards
const TEXT_COLOR = '#1e293b'; // Dark blue-gray for text
const SUBTLE_TEXT = '#64748b'; // Subtle gray for secondary text

const getScoreColor = () => PRIMARY_COLOR;
const getCategoryScoreColor = () => PRIMARY_COLOR;

export default function ScoreDisplay({ score, chat }: ScoreDisplayProps) {
  // Use training_type field, fallback to title parsing for backward compatibility
  const isOffboardingTraining = chat?.training_type === 'offboarding' || chat?.title?.startsWith('Offboarding:');
  const categoryNames = isOffboardingTraining ? offboardingCategoryNames : interviewCategoryNames;

  if (!score) {
    return (
      <Box style={{ padding: '2rem', textAlign: 'center' }}>
        <Text size="3" style={{ color: SUBTLE_TEXT }}>
          No performance score available for this interview.
        </Text>
      </Box>
    );
  }

  const categories = isOffboardingTraining ? [
    { key: 'empathy_emotional_intelligence', score: (score as OffboardingScore).empathy_emotional_intelligence },
    { key: 'communication_professionalism', score: (score as OffboardingScore).communication_professionalism },
    { key: 'clarity_of_next_steps', score: (score as OffboardingScore).clarity_of_next_steps },
    { key: 'transition_planning_logistics', score: (score as OffboardingScore).transition_planning_logistics },
    { key: 'conflict_resolution', score: (score as OffboardingScore).conflict_resolution },
    { key: 'assessment_thoughtfulness', score: (score as OffboardingScore).assessment_thoughtfulness }
  ] as const : [
    { key: 'question_quality', score: (score as InterviewScore).question_quality },
    { key: 'followup_skills', score: (score as InterviewScore).followup_skills },
    { key: 'assessment_thoughtfulness', score: (score as InterviewScore).assessment_thoughtfulness },
    { key: 'interview_conduct', score: (score as InterviewScore).interview_conduct },
    { key: 'communication_rapport', score: (score as InterviewScore).communication_rapport },
    { key: 'professional_judgment', score: (score as InterviewScore).professional_judgment }
  ] as const;

  return (
    <Box style={{ padding: '2rem', background: '#fff', color: TEXT_COLOR }}>
      {/* Overall Score */}
      <Box style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Text size="2" style={{ color: SUBTLE_TEXT, marginBottom: '0.5rem' }}>
          Overall {isOffboardingTraining ? 'Offboarding' : 'Interview'} Performance Score
        </Text>
        <Box style={{ 
          fontSize: '3rem', 
          fontWeight: 'bold', 
          color: getScoreColor(),
          marginBottom: '0.5rem',
          letterSpacing: '-1px',
        }}>
          {score.overall_score}
        </Box>
        <Text size="2" style={{ color: SUBTLE_TEXT }}>
          out of 100
        </Text>
      </Box>

      {/* Category Breakdown */}
      <Box style={{ marginBottom: '2rem' }}>
        <Text size="3" weight="bold" style={{ marginBottom: '1rem', display: 'block', color: TEXT_COLOR }}>
          Category Breakdown
        </Text>
        <Flex direction="column" gap="3">
          {categories.map(({ key, score: categoryScore }) => (
            <Card key={key} size="2" style={{ padding: '1rem', background: CARD_BG, boxShadow: 'none' }}>
              <Flex justify="between" align="center">
                <Text size="2" weight="medium" style={{ color: TEXT_COLOR }}>
                  {categoryNames[key as keyof typeof categoryNames]}
                </Text>
                <Flex align="center" gap="2">
                  <Box style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 'bold', 
                    color: getCategoryScoreColor() 
                  }}>
                    {categoryScore}
                  </Box>
                  <Text size="1" style={{ color: SUBTLE_TEXT }}>
                    /5
                  </Text>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      </Box>
    </Box>
  );
} 
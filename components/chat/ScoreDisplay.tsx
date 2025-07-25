import React from 'react';
import { Box, Flex, Text, Card } from '@radix-ui/themes';

interface InterviewScore {
  id: string;
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
  created_at: string;
}

interface ScoreDisplayProps {
  score: InterviewScore | null;
  candidateName: string;
  chat?: any;
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
  legal_procedural_compliance: 'Legal & Procedural Compliance',
  transition_planning_logistics: 'Transition Planning & Logistics',
  conflict_resolution: 'Conflict Resolution & Difficult Conversations',
  assessment_thoughtfulness: 'Assessment Thoughtfulness & Reflection'
};

const getScoreColor = (score: number) => {
  if (score >= 90) return 'var(--green-9)';
  if (score >= 80) return 'var(--blue-9)';
  if (score >= 70) return 'var(--yellow-9)';
  if (score >= 60) return 'var(--orange-9)';
  return 'var(--red-9)';
};

const getCategoryScoreColor = (score: number) => {
  if (score >= 4.5) return 'var(--green-9)';
  if (score >= 4) return 'var(--blue-9)';
  if (score >= 3) return 'var(--yellow-9)';
  if (score >= 2) return 'var(--orange-9)';
  return 'var(--red-9)';
};

export default function ScoreDisplay({ score, candidateName, chat }: ScoreDisplayProps) {
  const isOffboardingTraining = chat?.title?.startsWith('Offboarding:');
  const categoryNames = isOffboardingTraining ? offboardingCategoryNames : interviewCategoryNames;

  if (!score) {
    return (
      <Box style={{ padding: '2rem', textAlign: 'center' }}>
        <Text size="3" style={{ color: 'var(--gray-11)' }}>
          No performance score available for this interview.
        </Text>
      </Box>
    );
  }

  const categories = isOffboardingTraining ? [
    { key: 'empathy_emotional_intelligence', score: score.empathy_emotional_intelligence },
    { key: 'communication_professionalism', score: score.communication_professionalism },
    { key: 'legal_procedural_compliance', score: score.legal_procedural_compliance },
    { key: 'transition_planning_logistics', score: score.transition_planning_logistics },
    { key: 'conflict_resolution', score: score.conflict_resolution },
    { key: 'assessment_thoughtfulness', score: score.assessment_thoughtfulness }
  ] as const : [
    { key: 'question_quality', score: score.question_quality },
    { key: 'followup_skills', score: score.followup_skills },
    { key: 'assessment_thoughtfulness', score: score.assessment_thoughtfulness },
    { key: 'interview_conduct', score: score.interview_conduct },
    { key: 'communication_rapport', score: score.communication_rapport },
    { key: 'professional_judgment', score: score.professional_judgment }
  ] as const;

  return (
    <Box style={{ padding: '2rem' }}>
      {/* Overall Score */}
      <Box style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Text size="2" style={{ color: 'var(--gray-11)', marginBottom: '0.5rem' }}>
          Overall {isOffboardingTraining ? 'Offboarding' : 'Interview'} Performance Score
        </Text>
        <Box style={{ 
          fontSize: '3rem', 
          fontWeight: 'bold', 
          color: getScoreColor(score.overall_score),
          marginBottom: '0.5rem'
        }}>
          {score.overall_score}
        </Box>
        <Text size="2" style={{ color: 'var(--gray-11)' }}>
          out of 100
        </Text>
      </Box>

      {/* Category Breakdown */}
      <Box style={{ marginBottom: '2rem' }}>
        <Text size="3" weight="bold" style={{ marginBottom: '1rem', display: 'block' }}>
          Category Breakdown
        </Text>
        <Flex direction="column" gap="3">
          {categories.map(({ key, score: categoryScore }) => (
            <Card key={key} size="2" style={{ padding: '1rem' }}>
              <Flex justify="between" align="center">
                <Text size="2" weight="medium">
                  {categoryNames[key]}
                </Text>
                <Flex align="center" gap="2">
                  <Box style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 'bold', 
                    color: getCategoryScoreColor(categoryScore) 
                  }}>
                    {categoryScore}
                  </Box>
                  <Text size="1" style={{ color: 'var(--gray-11)' }}>
                    /5
                  </Text>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      </Box>

      {/* Strengths */}
      {score.strengths && score.strengths.length > 0 && (
        <Box style={{ marginBottom: '2rem' }}>
          <Text size="3" weight="bold" style={{ marginBottom: '1rem', display: 'block', color: 'var(--green-11)' }}>
            Key Strengths
          </Text>
          <Flex direction="column" gap="2">
            {score.strengths.map((strength, index) => (
              <Flex key={index} align="start" gap="2">
                <Text style={{ color: 'var(--green-9)', marginTop: '0.1rem' }}>•</Text>
                <Text size="2" style={{ lineHeight: '1.5' }}>
                  {strength}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Box>
      )}

      {/* Improvement Areas */}
      {score.improvement_areas && score.improvement_areas.length > 0 && (
        <Box style={{ marginBottom: '2rem' }}>
          <Text size="3" weight="bold" style={{ marginBottom: '1rem', display: 'block', color: 'var(--orange-11)' }}>
            Areas for Improvement
          </Text>
          <Flex direction="column" gap="2">
            {score.improvement_areas.map((area, index) => (
              <Flex key={index} align="start" gap="2">
                <Text style={{ color: 'var(--orange-9)', marginTop: '0.1rem' }}>•</Text>
                <Text size="2" style={{ lineHeight: '1.5' }}>
                  {area}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Box>
      )}

      {/* Overall Feedback */}
      {score.overall_feedback && (
        <Box>
          <Text size="3" weight="bold" style={{ marginBottom: '1rem', display: 'block' }}>
            Overall Feedback
          </Text>
          <Card size="2" style={{ padding: '1rem', backgroundColor: 'var(--gray-2)' }}>
            <Text size="2" style={{ lineHeight: '1.6' }}>
              {score.overall_feedback}
            </Text>
          </Card>
        </Box>
      )}
    </Box>
  );
} 
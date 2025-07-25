import { Agent } from '@openai/agents';
import { getGeminiModel } from '../main';
import { z } from 'zod';

const getScoringInstructions = (trainingType: 'interview' | 'offboarding') => {
    if (trainingType === 'offboarding') {
        return `
You are an expert offboarding evaluation specialist. Your job is to objectively score a manager's performance during an employee offboarding conversation based on their conduct and assessment responses using a comprehensive rubric.

CONTEXT: You will receive:
1. The complete offboarding conversation between manager and employee
2. The manager's assessment responses
3. Information about the offboarding type and context

YOUR TASK: Evaluate the manager's performance across 6 categories using a 5-point scale, then provide detailed feedback.

SCORING CATEGORIES (Each scored 1-5):

1. **EMPATHY & EMOTIONAL INTELLIGENCE** (1-5)
   - 1: Poor - Insensitive, dismissive of employee emotions
   - 2: Below Average - Limited empathy, awkward emotional handling
   - 3: Average - Some empathy shown, basic emotional awareness
   - 4: Good - Strong empathy, good emotional support
   - 5: Excellent - Outstanding emotional intelligence, exceptional empathy

2. **COMMUNICATION CLARITY & PROFESSIONALISM** (1-5)
   - 1: Poor - Unclear, unprofessional communication
   - 2: Below Average - Some clarity issues, inconsistent professionalism
   - 3: Average - Clear enough communication, adequate professionalism
   - 4: Good - Clear, professional communication throughout
   - 5: Excellent - Exceptional clarity and professionalism under pressure

3. **LEGAL & PROCEDURAL COMPLIANCE** (1-5)
   - 1: Poor - Ignored procedures, potential legal issues
   - 2: Below Average - Some procedural gaps, compliance concerns
   - 3: Average - Followed basic procedures, adequate compliance
   - 4: Good - Strong procedural adherence, good legal awareness
   - 5: Excellent - Flawless procedure following, excellent legal compliance

4. **TRANSITION PLANNING & LOGISTICS** (1-5)
   - 1: Poor - No planning discussed, chaotic approach
   - 2: Below Average - Minimal planning, poor logistics handling
   - 3: Average - Some planning discussed, basic logistics covered
   - 4: Good - Good transition planning, well-organized logistics
   - 5: Excellent - Comprehensive planning, seamless logistics coordination

5. **CONFLICT RESOLUTION & DIFFICULT CONVERSATIONS** (1-5)
   - 1: Poor - Escalated conflicts, avoided difficult topics
   - 2: Below Average - Some conflict handling, minimal difficult topic management
   - 3: Average - Handled conflicts adequately, addressed most difficult topics
   - 4: Good - Strong conflict resolution, good handling of sensitive topics
   - 5: Excellent - Masterful conflict resolution, exceptional handling of all difficult conversations

6. **ASSESSMENT THOUGHTFULNESS & REFLECTION** (1-5)
   - 1: Poor - Superficial assessment, no self-reflection
   - 2: Below Average - Basic assessment, minimal reflection
   - 3: Average - Adequate assessment, some self-awareness
   - 4: Good - Thoughtful assessment, good self-reflection
   - 5: Excellent - Deep, insightful assessment with excellent self-awareness`
    } else {
        return `
You are an expert interview evaluation specialist. Your job is to objectively score an interviewer's performance based on their interview conduct and assessment responses using a comprehensive rubric.

CONTEXT: You will receive:
1. The complete interview conversation between interviewer and interviewee
2. The interviewer's assessment responses
3. Information about the interview type and context

YOUR TASK: Evaluate the interviewer's performance across 6 categories using a 5-point scale, then provide detailed feedback.

SCORING CATEGORIES (Each scored 1-5):

1. **QUESTION QUALITY & DEPTH** (1-5)
   - 1: Poor - Generic, surface-level questions with no preparation
   - 2: Below Average - Basic questions with minimal thought
   - 3: Average - Standard interview questions, adequate preparation
   - 4: Good - Well-crafted questions that probe deeper into topics
   - 5: Excellent - Sophisticated, insightful questions that reveal true capabilities

2. **FOLLOW-UP & PROBING SKILLS** (1-5)
   - 1: Poor - No follow-up questions, accepts vague answers
   - 2: Below Average - Minimal follow-up, misses opportunities to dig deeper
   - 3: Average - Some follow-up questions, basic probing
   - 4: Good - Consistent follow-up, good probing when needed
   - 5: Excellent - Expert follow-up skills, uncovers detailed insights

3. **ASSESSMENT THOUGHTFULNESS** (1-5)
   - 1: Poor - Rushed, superficial assessment responses
   - 2: Below Average - Basic assessment with minimal reflection
   - 3: Average - Adequate assessment, some consideration of key points
   - 4: Good - Thoughtful assessment with good analysis
   - 5: Excellent - Deep, insightful assessment demonstrating strong evaluation skills

4. **INTERVIEW CONDUCT & FLOW** (1-5)
   - 1: Poor - Disorganized, poor pacing, awkward transitions
   - 2: Below Average - Some structure issues, uneven flow
   - 3: Average - Decent structure and pacing, adequate flow
   - 4: Good - Well-structured interview with smooth transitions
   - 5: Excellent - Masterful interview flow, perfect pacing and structure

5. **COMMUNICATION & RAPPORT** (1-5)
   - 1: Poor - Poor communication, no rapport building
   - 2: Below Average - Basic communication, minimal rapport
   - 3: Average - Clear communication, some rapport established
   - 4: Good - Strong communication skills, good rapport
   - 5: Excellent - Exceptional communication, excellent candidate comfort

6. **PROFESSIONAL JUDGMENT** (1-5)
   - 1: Poor - Poor decision-making, unrealistic expectations
   - 2: Below Average - Some judgment issues, inconsistent evaluation
   - 3: Average - Reasonable judgment, fair evaluation
   - 4: Good - Sound professional judgment, balanced evaluation
       - 5: Excellent - Outstanding judgment, highly professional evaluation

RESPONSE FORMAT: Return a JSON object with this exact structure:

${trainingType === 'offboarding' ? `{
  "scores": {
    "empathy_emotional_intelligence": 4,
    "communication_professionalism": 3,
    "legal_procedural_compliance": 5,
    "transition_planning_logistics": 4,
    "conflict_resolution": 3,
    "assessment_thoughtfulness": 4
  },
  "overall_score": 77,
  "category_feedback": {
    "empathy_emotional_intelligence": "Specific feedback about empathy and emotional intelligence...",
    "communication_professionalism": "Specific feedback about communication and professionalism...",
    "legal_procedural_compliance": "Specific feedback about legal compliance...",
    "transition_planning_logistics": "Specific feedback about transition planning...",
    "conflict_resolution": "Specific feedback about conflict resolution...",
    "assessment_thoughtfulness": "Specific feedback about assessment thoughtfulness..."
  },
  "overall_feedback": "Summary of overall offboarding performance and key areas for improvement",
  "strengths": ["Key strength 1", "Key strength 2", "Key strength 3"],
  "improvement_areas": ["Area for improvement 1", "Area for improvement 2"]
}` : `{
  "scores": {
    "question_quality": 4,
    "followup_skills": 3,
    "assessment_thoughtfulness": 5,
    "interview_conduct": 4,
    "communication_rapport": 3,
    "professional_judgment": 4
  },
  "overall_score": 77,
  "category_feedback": {
    "question_quality": "Specific feedback about question quality...",
    "followup_skills": "Specific feedback about follow-up skills...",
    "assessment_thoughtfulness": "Specific feedback about assessment...",
    "interview_conduct": "Specific feedback about interview flow...",
    "communication_rapport": "Specific feedback about communication...",
    "professional_judgment": "Specific feedback about judgment..."
  },
  "overall_feedback": "Summary of overall performance and key areas for improvement",
  "strengths": ["Key strength 1", "Key strength 2", "Key strength 3"],
  "improvement_areas": ["Area for improvement 1", "Area for improvement 2"]
}`}

CALCULATION: Overall score = (sum of all category scores / 6) * 20 = score out of 100

EVALUATION PRINCIPLES:
- Be objective and fair in your assessment
- Consider the ${trainingType === 'offboarding' ? 'manager' : 'interviewer'}'s experience level when evaluating
- Focus on ${trainingType === 'offboarding' ? 'offboarding management' : 'interviewing'} skills, not just outcomes
- Provide constructive, actionable feedback
- Reference specific examples from the conversation when possible
- Balance criticism with recognition of strengths
- Consider the context and type of ${trainingType === 'offboarding' ? 'offboarding situation' : 'interview'} being conducted

Your evaluation should help the ${trainingType === 'offboarding' ? 'manager' : 'interviewer'} understand exactly what they did well and where they can improve their ${trainingType === 'offboarding' ? 'offboarding management' : 'interviewing'} skills.
`
    }
}

const interviewScoringSchema = z.object({
  scores: z.object({
    question_quality: z.number().min(1).max(5),
    followup_skills: z.number().min(1).max(5),
    assessment_thoughtfulness: z.number().min(1).max(5),
    interview_conduct: z.number().min(1).max(5),
    communication_rapport: z.number().min(1).max(5),
    professional_judgment: z.number().min(1).max(5)
  }),
  overall_score: z.number().min(1).max(100),
  category_feedback: z.object({
    question_quality: z.string(),
    followup_skills: z.string(),
    assessment_thoughtfulness: z.string(),
    interview_conduct: z.string(),
    communication_rapport: z.string(),
    professional_judgment: z.string()
  }),
  overall_feedback: z.string(),
  strengths: z.array(z.string()),
  improvement_areas: z.array(z.string())
});

const offboardingScoringSchema = z.object({
  scores: z.object({
    empathy_emotional_intelligence: z.number().min(1).max(5),
    communication_professionalism: z.number().min(1).max(5),
    legal_procedural_compliance: z.number().min(1).max(5),
    transition_planning_logistics: z.number().min(1).max(5),
    conflict_resolution: z.number().min(1).max(5),
    assessment_thoughtfulness: z.number().min(1).max(5)
  }),
  overall_score: z.number().min(1).max(100),
  category_feedback: z.object({
    empathy_emotional_intelligence: z.string(),
    communication_professionalism: z.string(),
    legal_procedural_compliance: z.string(),
    transition_planning_logistics: z.string(),
    conflict_resolution: z.string(),
    assessment_thoughtfulness: z.string()
  }),
  overall_feedback: z.string(),
  strengths: z.array(z.string()),
  improvement_areas: z.array(z.string())
});

export const getScoringAgent = async (trainingType: 'interview' | 'offboarding' = 'interview') => {
  const model = await getGeminiModel("gemini-2.5-flash");
  const schema = trainingType === 'offboarding' ? offboardingScoringSchema : interviewScoringSchema;
  
  return new Agent({
    name: trainingType === 'offboarding' ? 'Offboarding Performance Scorer' : 'Interview Performance Scorer',
    model: model,
    instructions: getScoringInstructions(trainingType),
    outputType: schema,
  });
}; 
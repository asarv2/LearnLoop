//Questions for the assessment

export interface AssessmentQuestion {
  id: string;
  type: 'rating' | 'multiple_choice' | 'yes_no' | 'text';
  question: string;
  options?: string[];
  context?: string;
}

// Static questions for interview training
export const INTERVIEW_STATIC_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "hire_decision",
    type: "multiple_choice",
    question: "Based on this interview, would you move forward with this candidate?",
    options: [
      "Strong Yes - Definitely move to next round",
      "Yes - Move forward with some reservations", 
      "Maybe - Need more evaluation",
      "No - Would not move forward",
      "Strong No - Clear rejection"
    ],
  },
  {
    id: "cheating_suspicion",
    type: "yes_no", 
    question: "Do you suspect this candidate may have used AI assistance tools during the interview?",
  }
];

// Static questions for offboarding training
export const OFFBOARDING_STATIC_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "offboarding_approach",
    type: "multiple_choice",
    question: "How would you rate your overall approach to this offboarding conversation?",
    options: [
      "Excellent - Professional, empathetic, and comprehensive",
      "Good - Handled most aspects well with minor areas for improvement",
      "Fair - Adequate but several areas need improvement",
      "Poor - Significant issues in approach or communication",
      "Very Poor - Unprofessional or inappropriate handling"
    ],
  },
  {
    id: "employee_support",
    type: "rating",
    question: "How well did you address the employee's emotional and practical concerns? (1-5 scale)",
  }
];

// Get static questions based on training type
export const getStaticQuestions = (chatTitle: string): AssessmentQuestion[] => {
  if (chatTitle.startsWith('Offboarding:')) {
    return OFFBOARDING_STATIC_QUESTIONS;
  }
  // Default to interview questions for backward compatibility
  return INTERVIEW_STATIC_QUESTIONS;
};

// Legacy export for backward compatibility
export const STATIC_ASSESSMENT_QUESTIONS = INTERVIEW_STATIC_QUESTIONS;

export const getQuestionById = (questions: AssessmentQuestion[], id: string): AssessmentQuestion | undefined => {
  return questions.find(q => q.id === id);
};

export const getTotalQuestions = (questions: AssessmentQuestion[]): number => {
  return questions.length;
}; 
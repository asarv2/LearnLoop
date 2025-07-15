//Questions for the assessment
import { AssessmentQuestion } from "@/types";

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [

  {
    id: "strengths",
    type: "multiple_choice",
    question: "What were the candidate's strongest areas?",
    options: [
      "Technical knowledge and expertise",
      "Problem-solving approach",
      "Communication and explanation skills",
      "Experience and background",
      "Confidence and presence",
      "Specific project examples",
      "Questions they asked",
      "None stood out particularly"
    ],
  },
  {
    id: "red_flags",
    type: "multiple_choice", 
    question: "Did you notice any concerning signs during the interview?",
    options: [
      "Overly polished, textbook-perfect answers",
      "Vague or generic responses lacking personal details",
      "Inconsistent knowledge depth",
      "Buzzword-heavy language without substance",
      "Hesitation before providing detailed answers",
      "Responses that seemed copied from resources",
      "Difficulty with follow-up questions",
      "None of the above - responses seemed natural"
    ],
  },
  {
    id: "authenticity_rating",
    type: "rating",
    question: "How authentic did the candidate's responses feel?",
  },
  {
    id: "follow_up_performance",
    type: "multiple_choice",
    question: "How well did the candidate handle follow-up questions and deeper dives?",
    options: [
      "Excellent - Provided rich additional details naturally",
      "Good - Answered adequately with some specifics",
      "Average - Basic responses without much depth", 
      "Poor - Struggled to elaborate or gave vague answers",
      "Very Poor - Avoided details or seemed uncomfortable"
    ],
  },
  {
    id: "technical_depth",
    type: "multiple_choice",
    question: "How would you rate their technical knowledge demonstration?",
    options: [
      "Deep expertise with nuanced understanding",
      "Solid knowledge with good practical examples",
      "Surface-level knowledge, basic understanding",
      "Inconsistent - some areas strong, others weak",
      "Shallow knowledge, mostly buzzwords",
      "Unable to demonstrate real technical depth"
    ],
  },
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

export const getQuestionById = (id: string): AssessmentQuestion | undefined => {
  return ASSESSMENT_QUESTIONS.find(q => q.id === id);
};

export const getTotalQuestions = (): number => {
  return ASSESSMENT_QUESTIONS.length;
}; 
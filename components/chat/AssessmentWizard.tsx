//Assessment Wizard for the interview assessment
"use client";

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle,
  Box,
  Typography,
  LinearProgress,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Rating,
  TextField,
  Card,
  CardContent,
  CircularProgress,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { ArrowBack, ArrowForward } from '@mui/icons-material';
import { AssessmentQuestion, getStaticQuestions, getTotalQuestions } from '@/utils/assessment/questions';
import { Assessment, Message, Chat } from '@/types';
import { logError } from '@/utils/logger';

// Styled components for professional look
const StyledDialog = styled(Dialog)(() => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    minWidth: 600,
    maxWidth: 800,
    minHeight: 500,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
  },
}));

const StyledCard = styled(Card)(() => ({
  borderRadius: 12,
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
  border: '1px solid rgba(0, 0, 0, 0.08)',
}));

const StyledButton = styled(Button)(() => ({
  borderRadius: 8,
  textTransform: 'none',
  fontWeight: 600,
  padding: '10px 24px',
}));

interface AssessmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (responses: Assessment['responses']) => void;
  candidateName: string;
  isSubmitting?: boolean;
  messages: Message[];
  chat: Chat;
}

export default function AssessmentWizard({
  isOpen,
  onClose,
  onComplete,
  candidateName,
  isSubmitting = false,
  messages,
  chat
}: AssessmentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<{ [key: string]: string | number }>({});
  const [allQuestions, setAllQuestions] = useState<AssessmentQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  // Fetch dynamic questions on component mount
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!isOpen || !messages.length) return;
      
      setIsLoadingQuestions(true);
      setQuestionsError(null);
      
      try {
        const response = await fetch('/api/chat/assessment/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messages,
            chatType: chat?.type || 'regular',
            chatTitle: chat?.title || 'Interview'
          })
        });

        const data = await response.json();
        
        if (data.questions && Array.isArray(data.questions)) {
          // Get appropriate static questions based on training type
          const staticQuestions = getStaticQuestions(chat?.title || '');
          // Combine dynamic questions with training-specific static ones
          const combinedQuestions = [...data.questions, ...staticQuestions];
          setAllQuestions(combinedQuestions);
        } else {
          throw new Error('Invalid questions format');
        }
      } catch (error) {
        logError('Error fetching assessment questions:', error);
        setQuestionsError('Failed to load assessment questions. Please try again.');
        // Fallback to training-specific static questions only
        const staticQuestions = getStaticQuestions(chat?.title || '');
        setAllQuestions(staticQuestions);
      } finally {
        setIsLoadingQuestions(false);
      }
    };

    fetchQuestions();
  }, [isOpen, messages, chat]);

  const currentQuestion = allQuestions[currentStep];
  const totalQuestions = getTotalQuestions(allQuestions);
  const isLastQuestion = currentStep === totalQuestions - 1;
  const canProceed = responses[currentQuestion?.id] !== undefined;

  const handleResponse = (value: string | number) => {
    if (!currentQuestion) return;
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Convert responses to the format expected by the API
      const assessmentResponses: Assessment['responses'] = Object.entries(responses).map(([question_id, response]) => ({
        question_id,
        response
      }));
      onComplete(assessmentResponses);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderQuestionInput = () => {
    if (!currentQuestion) return null;
    
    const currentResponse = responses[currentQuestion.id];

    switch (currentQuestion.type) {
      case 'yes_no':
        return (
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={currentResponse || ''}
              onChange={(e) => handleResponse(e.target.value)}
            >
              <FormControlLabel 
                value="yes" 
                control={<Radio />} 
                label="Yes" 
                sx={{ mb: 2 }}
              />
              <FormControlLabel 
                value="no" 
                control={<Radio />} 
                label="No" 
              />
            </RadioGroup>
          </FormControl>
        );

      case 'multiple_choice':
        return (
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={currentResponse || ''}
              onChange={(e) => handleResponse(e.target.value)}
            >
              {currentQuestion.options?.map((option, index) => (
                <FormControlLabel
                  key={index}
                  value={option}
                  control={<Radio />}
                  label={option}
                  sx={{ mb: 1.5, alignItems: 'flex-start' }}
                />
              ))}
            </RadioGroup>
          </FormControl>
        );

      case 'rating':
        return (
          <Box sx={{ py: 3 }}>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Rating
                value={currentResponse as number || 0}
                onChange={(_, newValue) => newValue && handleResponse(newValue)}
                size="large"
                max={5}
              />
            </Box>
          </Box>
        );

      case 'text':
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Please provide your detailed thoughts and observations..."
            value={currentResponse as string || ''}
            onChange={(e) => handleResponse(e.target.value)}
            variant="outlined"
          />
        );

      default:
        return null;
    }
  };

  // Loading state
  if (isLoadingQuestions) {
    return (
      <StyledDialog 
        open={isOpen} 
        onClose={() => {}} // Disable closing
        maxWidth="sm" 
        fullWidth
        disableEscapeKeyDown
      >
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
            <CircularProgress size={48} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Preparing Your Assessment
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {chat?.title?.startsWith('Offboarding:') 
                ? 'Analyzing the offboarding conversation to create personalized questions...'
                : 'Analyzing the interview to create personalized questions...'
              }
            </Typography>
          </Box>
        </DialogContent>
      </StyledDialog>
    );
  }

  // Error state
  if (questionsError) {
    return (
      <StyledDialog 
        open={isOpen} 
        onClose={() => {}} // Disable closing
        maxWidth="sm" 
        fullWidth
        disableEscapeKeyDown
      >
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              {questionsError}
            </Alert>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <StyledButton onClick={onClose}>
                Close
              </StyledButton>
            </Box>
          </Box>
        </DialogContent>
      </StyledDialog>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <StyledDialog 
      open={isOpen} 
      onClose={() => {}} // Disable closing by clicking outside or escape key
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>
              {chat?.title?.startsWith('Offboarding:') ? 'Offboarding Assessment' : 'Interview Assessment'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {chat?.title?.startsWith('Offboarding:') ? 'Employee' : 'Candidate'}: {candidateName}
            </Typography>
          </Box>
          {/* Remove the close button to prevent accidental closing */}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 4 }}>
          {/* Progress */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Question {currentStep + 1} of {totalQuestions}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(((currentStep + 1) / totalQuestions) * 100)}% Complete
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(currentStep + 1) / totalQuestions * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Question */}
        <StyledCard sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              {currentQuestion.question}
            </Typography>
            
            {currentQuestion.context && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {currentQuestion.context}
              </Alert>
            )}

            {renderQuestionInput()}
          </CardContent>
        </StyledCard>

        {/* Navigation */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <StyledButton
            variant="outlined"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            startIcon={<ArrowBack />}
          >
            Previous
          </StyledButton>
          
          <StyledButton
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed || (isSubmitting && isLastQuestion)}
            endIcon={isLastQuestion ? undefined : <ArrowForward />}
          >
            {isSubmitting && isLastQuestion ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Generating score and feedback...
              </>
            ) : isLastQuestion ? (
              'Complete Assessment'
            ) : (
              'Next Question'
            )}
          </StyledButton>
        </Box>
      </DialogContent>
    </StyledDialog>
  );
}
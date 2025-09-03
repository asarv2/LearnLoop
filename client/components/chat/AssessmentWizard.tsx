//Assessment Wizard for the interview assessment
"use client";

import { api } from "@/lib/api/fetcher";
import { useAssessment } from "@/lib/api/hooks/useAssessments";
import { useQuestionsByAssessment } from "@/lib/api/hooks/useQuestions";
import { Chat } from "@/types";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useEffect, useState } from "react";

// Styled components for professional look
const StyledDialog = styled(Dialog)(() => ({
  "& .MuiDialog-paper": {
    borderRadius: 16,
    minWidth: 600,
    maxWidth: 800,
    minHeight: 500,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
  },
}));

const StyledCard = styled(Card)(() => ({
  borderRadius: 12,
  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
  border: "1px solid rgba(0, 0, 0, 0.08)",
}));

const StyledButton = styled(Button)(() => ({
  borderRadius: 8,
  textTransform: "none",
  fontWeight: 600,
  padding: "10px 24px",
}));

interface AssessmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (responses: unknown) => void;
  isSubmitting?: boolean;
  assessmentId: string;
  chat: Chat;
}

export default function AssessmentWizard({
  isOpen,
  onClose,
  onComplete,
  isSubmitting = false,
  assessmentId,
  chat,
}: AssessmentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<{
    [key: string]: string | number;
  }>({});

  // Fetch assessment and questions
  const { data: assessment, isLoading: isLoadingAssessment } = useAssessment(
    assessmentId,
    isOpen
  );
  const {
    data: questions = [],
    isLoading: isLoadingQuestions,
    error: questionsError,
  } = useQuestionsByAssessment(assessmentId, isOpen);
  const expectedTotal = 7;

  const isLoading = isLoadingAssessment || isLoadingQuestions;
  const currentQuestion = questions[currentStep];
  const totalQuestions = questions.length;
  const hasAllQuestions = totalQuestions >= expectedTotal;
  const atEndOfLoaded = currentStep === totalQuestions - 1;
  const canFinish = hasAllQuestions && atEndOfLoaded;
  const isAwaitingNext = currentStep >= totalQuestions && !hasAllQuestions;
  const canProceed =
    currentQuestion &&
    currentQuestion.id &&
    responses[currentQuestion.id] !== undefined;

  // Initialize responses with existing question values
  useEffect(() => {
    if (questions.length > 0) {
      const existingResponses: { [key: string]: string | number } = {};
      questions.forEach((question) => {
        if (
          question.id &&
          question.value !== null &&
          question.value !== undefined
        ) {
          existingResponses[question.id] = question.value as string | number;
        }
      });
      setResponses(existingResponses);
    }
  }, [questions]);

  const handleResponse = (value: string | number) => {
    if (!currentQuestion || !currentQuestion.id) return;
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id as string]: value,
    }));
  };

  const persistCurrentAnswer = async () => {
    if (!currentQuestion || !currentQuestion.id) return;
    const qid = currentQuestion.id as string;
    const value = responses[qid];
    if (value === undefined) return;
    try {
      await api(`/api/v1/questions/${qid}`, {
        method: "PATCH",
        body: JSON.stringify({ value: String(value) }),
      });
    } catch {
      // Silent fail for now; UI still allows navigation
    }
  };

  const handleNext = async () => {
    // Persist the answer for the current question before navigating
    await persistCurrentAnswer();
    if (canFinish) {
      // Convert responses to the expected map shape: { [question_id]: response }
      const assessmentResponses: Record<string, unknown> = { ...responses };
      onComplete(assessmentResponses);
    } else {
      // Advance step optimistically; UI will show a loader while next question arrives
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const renderQuestionInput = () => {
    if (!currentQuestion || !currentQuestion.id) return null;

    const currentResponse =
      responses[currentQuestion.id] ??
      (currentQuestion.value as string | number | null | undefined);
    const isMcq =
      currentQuestion.question_type === "mcq" &&
      currentQuestion.options &&
      currentQuestion.options.length > 0;

    if (isMcq) {
      return (
        <FormControl component="fieldset" fullWidth>
          <RadioGroup
            value={currentResponse || ""}
            onChange={(e) => handleResponse(e.target.value)}
          >
            {currentQuestion.options?.map((option: string, index: number) => (
              <FormControlLabel
                key={index}
                value={option}
                control={<Radio />}
                label={option}
                sx={{ mb: 1.5, alignItems: "flex-start" }}
              />
            ))}
          </RadioGroup>
        </FormControl>
      );
    } else {
      // FRQ (Free Response Question)
      return (
        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="Please provide your detailed thoughts and observations..."
          value={(currentResponse as string) || ""}
          onChange={(e) => handleResponse(e.target.value)}
          variant="outlined"
        />
      );
    }
  };

  // Initial loading state
  if (isLoading) {
    return (
      <StyledDialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress size={48} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Loading Assessment
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              Preparing your assessment questions...
            </Typography>
          </Box>
        </DialogContent>
      </StyledDialog>
    );
  }

  // Error state
  if (questionsError) {
    return (
      <StyledDialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              Failed to load assessment questions. Please try again.
            </Alert>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <StyledButton onClick={onClose}>Close</StyledButton>
            </Box>
          </Box>
        </DialogContent>
      </StyledDialog>
    );
  }

  // Awaiting background generation of the next question
  if (isAwaitingNext) {
    return (
      <StyledDialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 4,
            }}
          >
            <CircularProgress size={48} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Loading next question
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              Generating additional assessment questions...
            </Typography>
          </Box>
        </DialogContent>
      </StyledDialog>
    );
  }

  if (!currentQuestion || totalQuestions === 0) {
    return (
      <StyledDialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
              No questions found for this assessment.
            </Alert>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <StyledButton onClick={onClose}>Close</StyledButton>
            </Box>
          </Box>
        </DialogContent>
      </StyledDialog>
    );
  }

  return (
    <StyledDialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {assessment?.title || "Assessment"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Session: {chat?.title}
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{
              ml: 2,
              color: "text.secondary",
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 4 }}>
          {/* Progress */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Question {currentStep + 1} of 7
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(((currentStep + 1) / 7) * 100)}% Complete
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={((currentStep + 1) / 7) * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Question */}
        <StyledCard sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              {currentQuestion.stem}
            </Typography>

            {currentQuestion.default_question &&
              currentStep < totalQuestions - 2 && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  This is a standard assessment question.
                </Alert>
              )}

            {renderQuestionInput()}
          </CardContent>
        </StyledCard>

        {/* Navigation */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
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
            disabled={!canProceed || (isSubmitting && canFinish)}
            endIcon={canFinish ? undefined : <ArrowForward />}
          >
            {isSubmitting && canFinish ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Submitting assessment...
              </>
            ) : canFinish ? (
              "Complete Assessment"
            ) : (
              "Next Question"
            )}
          </StyledButton>
        </Box>
      </DialogContent>
    </StyledDialog>
  );
}

//Assessment Wizard for the interview assessment
"use client";

import { useAssessment } from "@/lib/api/hooks/useAssessments";
import { useQuestionsByAssessment } from "@/lib/api/hooks/useQuestions";
import { Assessment, Chat } from "@/types";
import { ArrowBack, ArrowForward } from "@mui/icons-material";
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
  LinearProgress,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";

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
  onComplete: (responses: Assessment["responses"]) => void;
  candidateName: string;
  isSubmitting?: boolean;
  assessmentId: string;
  chat: Chat;
}

export default function AssessmentWizard({
  isOpen,
  onClose,
  onComplete,
  candidateName,
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

  const isLoading = isLoadingAssessment || isLoadingQuestions;
  const currentQuestion = questions[currentStep];
  const totalQuestions = questions.length;
  const isLastQuestion = currentStep === totalQuestions - 1;
  const canProceed =
    currentQuestion &&
    currentQuestion.id &&
    responses[currentQuestion.id] !== undefined;

  const handleResponse = (value: string | number) => {
    if (!currentQuestion || !currentQuestion.id) return;
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id as string]: value,
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Convert responses to the format expected by the API
      const assessmentResponses: Assessment["responses"] = Object.entries(
        responses
      ).map(([question_id, response]) => ({
        question_id,
        response,
      }));
      onComplete(assessmentResponses);
    } else {
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

    const currentResponse = responses[currentQuestion.id];
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

  // Loading state
  if (isLoading) {
    return (
      <StyledDialog
        open={isOpen}
        onClose={() => {}} // Disable closing
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
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

  if (!currentQuestion || totalQuestions === 0) {
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
    <StyledDialog
      open={isOpen}
      onClose={() => {}} // Disable closing by clicking outside or escape key
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="h5" component="h2" gutterBottom>
              {assessment?.title || "Assessment"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {chat?.title?.startsWith("Offboarding:")
                ? "Employee"
                : "Candidate"}
              : {candidateName}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 4 }}>
          {/* Progress */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Question {currentStep + 1} of {totalQuestions}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(((currentStep + 1) / totalQuestions) * 100)}% Complete
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={((currentStep + 1) / totalQuestions) * 100}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Question */}
        <StyledCard sx={{ mb: 4 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
              {currentQuestion.stem}
            </Typography>

            {currentQuestion.default_question && (
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
            disabled={!canProceed || (isSubmitting && isLastQuestion)}
            endIcon={isLastQuestion ? undefined : <ArrowForward />}
          >
            {isSubmitting && isLastQuestion ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Generating score and feedback...
              </>
            ) : isLastQuestion ? (
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

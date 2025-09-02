/**
 * TrainingContext.tsx
 * Simplified training context focused on core training functionality
 * Replaces the complex simulation context with training-specific features
 * @AshokSaravanan222 & @siladiea
 */
"use client";

import { useWebSocket } from "@/contexts/websocket-context";
import { useChat } from "@/lib/api/hooks/useChats";
import {
  useEndTraining,
  useSendTrainingMessage,
  useSubmitAssessment,
  useTrainingMessages,
} from "@/lib/api/hooks/useTrainingMessages";
import { chatKeys } from "@/lib/api/keys";
import { Chat, Message } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Training context interface
interface TrainingContextType {
  // Core data
  chatId: string;
  chat: Chat | null; // Chat data from API
  messages: Message[]; // Messages array

  // Connection state
  isConnected: boolean;

  // Loading states
  isSendingMessage: boolean;
  isEndingTraining: boolean;
  isSubmittingAssessment: boolean;
  isGettingHints: boolean; // ✨ Add hints loading state
  isWaitingForAssessment: boolean; // ✅ NEW: Loading state while waiting for assessment
  isWaitingForFeedback: boolean; // ✅ NEW: Loading state while waiting for feedback

  // Training actions
  sendMessage: (message: string) => Promise<void>;
  endTraining: () => Promise<void>;
  submitAssessment: (responses: Record<string, unknown>) => Promise<void>;
  getHints: (messageId: string) => Promise<void>; // ✨ Add hints action

  // UI state
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  showAssessment: boolean;
  setShowAssessment: (show: boolean) => void;
  showFeedback: boolean;
  setShowFeedback: (show: boolean) => void;

  // Training status
  isTrainingActive: boolean;
  isTrainingCompleted: boolean;
}

const TrainingContext = createContext<TrainingContextType | null>(null);

export const useTraining = () => {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error("useTraining must be used within a TrainingProvider");
  }
  return context;
};

interface TrainingProviderProps {
  children: React.ReactNode;
  chatId: string;
}

export function TrainingProvider({ children, chatId }: TrainingProviderProps) {
  // Local UI state
  const [currentMessage, setCurrentMessage] = useState("");
  const [showAssessment, setShowAssessment] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // ✅ NEW: Loading states for assessment and feedback
  const [isWaitingForAssessment, setIsWaitingForAssessment] = useState(false);
  const [isWaitingForFeedback, setIsWaitingForFeedback] = useState(false);

  // ✅ NEW: Use refs to track last processed state to prevent infinite loops
  const lastProcessedAssessmentRef = useRef<string | null>(null);
  const lastProcessedFeedbackRef = useRef<string | null>(null);

  // WebSocket connection
  const { isConnected } = useWebSocket();

  // Query client for invalidation
  const queryClient = useQueryClient();

  // API hooks
  const { data: chat } = useChat(chatId);

  const { data: messages = [] } = useTrainingMessages(chatId);

  const sendMessageMutation = useSendTrainingMessage();
  const endTrainingMutation = useEndTraining();
  const submitAssessmentMutation = useSubmitAssessment();

  // Training status
  const isTrainingActive = chat ? !chat.completed : true;
  const isTrainingCompleted = chat ? chat.completed : false;

  // ✅ NEW: Reset tracking when chatId changes
  useEffect(() => {
    lastProcessedAssessmentRef.current = null;
    lastProcessedFeedbackRef.current = null;
    setShowAssessment(false);
    setShowFeedback(false);
    // ✅ NEW: Clear loading states when chatId changes
    setIsWaitingForAssessment(false);
    setIsWaitingForFeedback(false);
  }, [chatId]);

  // ✅ NEW: Event listeners for WebSocket events
  useEffect(() => {
    const invalidateChatQueries = () => {
      // Invalidate all chat-related queries
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({
        queryKey: ["chat-for-attempt", chat?.attempt_id],
      });
      queryClient.invalidateQueries({ queryKey: chatKeys.all });

      // Also invalidate related data that might be affected
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["assessments"] });
      queryClient.invalidateQueries({ queryKey: ["questions"] }); // ✅ Add questions invalidation
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    };

    const handleTrainingEnded = (event: CustomEvent) => {
      const {
        chatId: eventChatId,
        assessmentReady = false,
        assessmentId,
        questionCount,
        requiredCount,
      } = event.detail;
      if (eventChatId === chatId) {
        logInfo("Training ended for current chat, invalidating queries", {
          assessmentReady,
          assessmentId,
          questionCount,
          requiredCount,
        });

        // Invalidate all relevant queries
        invalidateChatQueries();

        // If we already have some questions, ensure the assessment question list is refreshed
        if (assessmentId) {
          queryClient.invalidateQueries({
            queryKey: ["questions", "assessment", assessmentId],
          });
        }

        // Only show assessment if it's ready (has all 7 questions)
        if (assessmentReady) {
          logInfo("Assessment is ready, showing assessment modal immediately");
          setShowAssessment(true);
          lastProcessedAssessmentRef.current = "assessment";
          setIsWaitingForAssessment(false);
        } else {
          logInfo("Assessment not ready yet, waiting for completion");
          setIsWaitingForAssessment(true);
        }
      }
    };

    const handleGradingCompleted = (event: CustomEvent) => {
      const { chatId: eventChatId } = event.detail;
      if (eventChatId === chatId) {
        logInfo("Grading completed for current chat, invalidating queries");

        // Invalidate all relevant queries
        invalidateChatQueries();

        // If we were waiting for assessment, show it now
        if (isWaitingForAssessment) {
          logInfo(
            "Assessment should now be complete, showing assessment modal"
          );
          setShowAssessment(true);
          lastProcessedAssessmentRef.current = "assessment";
          setIsWaitingForAssessment(false);
        }
      }
    };

    // ✅ NEW: Handle assessment completion event (when all 7 questions are ready)
    const handleAssessmentCompleted = (event: CustomEvent) => {
      const { chatId: eventChatId, assessmentId } = event.detail;
      if (eventChatId === chatId) {
        logInfo("Assessment completed for current chat", { assessmentId });

        // Invalidate all relevant queries
        invalidateChatQueries();

        // Precisely refetch the questions for this assessment to reveal newly added ones
        if (assessmentId) {
          queryClient.invalidateQueries({
            queryKey: ["questions", "assessment", assessmentId],
          });
        }

        // Show assessment modal immediately
        setShowAssessment(true);
        lastProcessedAssessmentRef.current = "assessment";
        setIsWaitingForAssessment(false);
      }
    };

    const handleAssessmentSubmitted = (event: CustomEvent) => {
      const { chatId: eventChatId } = event.detail;
      if (eventChatId === chatId) {
        logInfo("Assessment submitted for current chat, invalidating queries");

        // Invalidate all relevant queries
        invalidateChatQueries();

        // Hide assessment modal and show feedback modal immediately
        setShowAssessment(false);
        setShowFeedback(true);
        lastProcessedFeedbackRef.current = "feedback";

        // ✅ NEW: Clear loading state for feedback
        setIsWaitingForFeedback(false);
      }
    };

    // Add event listeners
    window.addEventListener(
      "trainingEnded",
      handleTrainingEnded as EventListener
    );
    window.addEventListener(
      "gradingCompleted",
      handleGradingCompleted as EventListener
    );
    window.addEventListener(
      "assessmentCompleted",
      handleAssessmentCompleted as EventListener
    );
    window.addEventListener(
      "assessmentSubmitted",
      handleAssessmentSubmitted as EventListener
    );

    // Cleanup event listeners
    return () => {
      window.removeEventListener(
        "trainingEnded",
        handleTrainingEnded as EventListener
      );
      window.removeEventListener(
        "gradingCompleted",
        handleGradingCompleted as EventListener
      );
      window.removeEventListener(
        "assessmentCompleted",
        handleAssessmentCompleted as EventListener
      );
      window.removeEventListener(
        "assessmentSubmitted",
        handleAssessmentSubmitted as EventListener
      );
    };
  }, [
    chatId,
    chat?.attempt_id,
    queryClient,
    isWaitingForAssessment,
    isWaitingForFeedback,
  ]);

  // ✅ NEW: Fallback mechanism to check for assessment/feedback when chat data changes
  useEffect(() => {
    if (!chat) return;

    // Check if assessment exists and we should show it
    const hasAssessment = chat.assessments && chat.assessments.length > 0;
    const hasFeedback = chat.feedback && chat.feedback.length > 0;

    // Prioritize feedback over assessment - only show assessment if no feedback exists
    if (
      hasFeedback &&
      !lastProcessedFeedbackRef.current &&
      !showAssessment &&
      !showFeedback
    ) {
      logInfo("Feedback available, showing feedback modal");
      setShowFeedback(true);
      lastProcessedFeedbackRef.current = "feedback";
      // ✅ NEW: Clear loading state for feedback
      setIsWaitingForFeedback(false);
    }
    // Only show assessment if training is completed, assessment exists, no feedback exists, and we haven't handled it yet
    else if (
      isTrainingCompleted &&
      hasAssessment &&
      !hasFeedback &&
      !lastProcessedAssessmentRef.current &&
      !showAssessment &&
      !showFeedback
    ) {
      logInfo(
        "Training completed with assessment (no feedback), showing assessment modal"
      );
      setShowAssessment(true);
      lastProcessedAssessmentRef.current = "assessment";
      // ✅ NEW: Clear loading state for assessment
      setIsWaitingForAssessment(false);
    }
  }, [chat, isTrainingCompleted, showAssessment, showFeedback]);

  // ✅ NEW: Additional fallback with delay for when assessment is created but data hasn't refreshed yet
  useEffect(() => {
    if (!chat || !isTrainingCompleted || lastProcessedAssessmentRef.current)
      return;

    // If training is completed but no assessment is shown yet, wait a bit and check again
    const timer = setTimeout(() => {
      if (
        !showAssessment &&
        !showFeedback &&
        !lastProcessedAssessmentRef.current
      ) {
        logInfo("Training completed, checking for assessment after delay");
        queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      }
    }, 2000); // Wait 2 seconds for assessment to be created

    return () => clearTimeout(timer);
  }, [
    chat,
    isTrainingCompleted,
    showAssessment,
    showFeedback,
    chatId,
    queryClient,
  ]);

  // ✅ NEW: Refetch chat data when WebSocket connection is restored
  useEffect(() => {
    if (isConnected && chatId) {
      logInfo("WebSocket connected, refetching chat data");
      queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      queryClient.invalidateQueries({
        queryKey: ["chat-for-attempt", chat?.attempt_id],
      });
    }
  }, [isConnected, chatId, chat?.attempt_id, queryClient]);

  // Training actions
  const sendMessage = async (message: string) => {
    if (!message.trim() || sendMessageMutation.isPending || !isTrainingActive) {
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({
        chatId,
        message,
      });
      logInfo(`Sent training message for chat ${chatId}`);
    } catch (error) {
      logError("Error sending training message:", error);
      throw error;
    }
  };

  const endTraining = async () => {
    if (endTrainingMutation.isPending) return;

    try {
      // ✅ NEW: Set loading state for assessment
      setIsWaitingForAssessment(true);
      await endTrainingMutation.mutateAsync({ chatId });
      logInfo(`Ended training for chat ${chatId}`);
      // Loading state will be cleared when assessment is received via WebSocket event
    } catch (error) {
      // ✅ NEW: Clear loading state on error
      setIsWaitingForAssessment(false);
      logError("Error ending training:", error);
      throw error;
    }
  };

  const submitAssessment = async (responses: Record<string, unknown>) => {
    try {
      // ✅ NEW: Set loading state for feedback
      setIsWaitingForFeedback(true);
      await submitAssessmentMutation.mutateAsync({
        chatId,
        responses,
      });
      // Loading state will be cleared when feedback is received via WebSocket event
      logInfo(`Submitted assessment for chat ${chatId}`);
    } catch (error) {
      // ✅ NEW: Clear loading state on error
      setIsWaitingForFeedback(false);
      logError("Error submitting assessment:", error);
      throw error;
    }
  };

  const getHints = async (messageId: string) => {
    try {
      // This will be handled by WebSocket
      logInfo(`Getting hints for message ${messageId} in chat ${chatId}`);
    } catch (error) {
      logError("Error getting hints:", error);
      throw error;
    }
  };

  // Context value
  const value: TrainingContextType = {
    // Core data
    chatId,
    chat: chat || null,
    messages,

    // Connection state
    isConnected,

    // Loading states
    isSendingMessage: sendMessageMutation.isPending,
    isEndingTraining: endTrainingMutation.isPending,
    isSubmittingAssessment: submitAssessmentMutation.isPending,
    isGettingHints: false, // Will be managed by WebSocket context
    isWaitingForAssessment, // ✅ NEW: Expose loading state for assessment
    isWaitingForFeedback, // ✅ NEW: Expose loading state for feedback

    // Training actions
    sendMessage,
    endTraining,
    submitAssessment,
    getHints,

    // UI state
    currentMessage,
    setCurrentMessage,
    showAssessment,
    setShowAssessment,
    showFeedback,
    setShowFeedback,

    // Training status
    isTrainingActive,
    isTrainingCompleted,
  };

  return (
    <TrainingContext.Provider value={value}>
      {children}
    </TrainingContext.Provider>
  );
}

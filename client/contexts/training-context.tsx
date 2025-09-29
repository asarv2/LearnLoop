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
  isGettingHints: boolean; // ✨ Add hints loading state
  isWaitingForFeedback: boolean; // ✅ NEW: Loading state while waiting for feedback

  // Grading progress state
  gradingProgress: {
    isGrading: boolean;
    currentStep: string;
    completedSteps: string[];
    progress: {
      rubric_name?: string;
      standards_count?: number;
      total_tools?: number;
      standards_graded?: number;
      strengths_count?: number;
      improvements_count?: number;
    };
    latestUpdate?: {
      type: string;
      message: string;
      standard_name?: string;
      score?: number;
      feedback_preview?: string;
    };
  };

  // Training actions
  sendMessage: (message: string, parentId?: string | null) => Promise<void>;
  endTraining: () => Promise<void>;
  getHints: (messageId: string) => Promise<void>; // ✨ Add hints action

  // UI state
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
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
  const [showFeedback, setShowFeedback] = useState(false);

  // ✅ NEW: Loading states for feedback
  const [isWaitingForFeedback, setIsWaitingForFeedback] = useState(false);

  // ✅ NEW: Grading progress state
  const [gradingProgress, setGradingProgress] = useState({
    isGrading: false,
    currentStep: "",
    completedSteps: [] as string[],
    progress: {} as {
      rubric_name?: string;
      standards_count?: number;
      total_tools?: number;
      standards_graded?: number;
      strengths_count?: number;
      improvements_count?: number;
    },
    latestUpdate: undefined as
      | {
          type: string;
          message: string;
          standard_name?: string;
          score?: number;
          feedback_preview?: string;
        }
      | undefined,
  });

  // ✅ NEW: Use refs to track last processed state to prevent infinite loops
  const lastProcessedFeedbackRef = useRef<string | null>(null);

  // WebSocket connection
  const { isConnected, sendWebRTCMessage, joinRoom, setParentCursor } =
    useWebSocket();

  // Query client for invalidation
  const queryClient = useQueryClient();

  // API hooks
  const { data: chat } = useChat(chatId);

  const { data: messages = [] } = useTrainingMessages(chatId);

  const sendMessageMutation = useSendTrainingMessage();
  const endTrainingMutation = useEndTraining();

  // Training status
  const isTrainingActive = chat ? !chat.completed : true;
  const isTrainingCompleted = chat ? chat.completed : false;

  // ✅ NEW: Reset tracking when chatId changes
  useEffect(() => {
    lastProcessedFeedbackRef.current = null;
    setShowFeedback(false);
    // ✅ NEW: Clear loading states when chatId changes
    setIsWaitingForFeedback(false);
    // ✅ NEW: Clear grading progress when chatId changes
    setGradingProgress({
      isGrading: false,
      currentStep: "",
      completedSteps: [],
      progress: {},
      latestUpdate: undefined,
    });
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
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    };

    const handleTrainingEnded = (event: CustomEvent) => {
      const { chatId: eventChatId } = event.detail;
      if (eventChatId === chatId) {
        logInfo("Training ended for current chat, invalidating queries");

        // Invalidate all relevant queries
        invalidateChatQueries();
      }
    };

    const handleGradingCompleted = (event: CustomEvent) => {
      const { chatId: eventChatId, rubric_grade_id, message } = event.detail;
      if (eventChatId === chatId) {
        logInfo("Grading completed for current chat, invalidating queries");

        // Invalidate all relevant queries
        invalidateChatQueries();

        // Don't auto-show feedback modal here - let the useEffect handle it once by default
        if (rubric_grade_id) {
          // Grading was successful - the useEffect will show the modal once
          logInfo(
            "Grading completed successfully, feedback will be shown by default"
          );
        } else {
          // Grading was skipped - show a message to user
          logInfo(`Grading skipped: ${message}`);
        }
        setIsWaitingForFeedback(false);

        // Clear grading progress state
        setGradingProgress({
          isGrading: false,
          currentStep: "",
          completedSteps: [],
          progress: {},
          latestUpdate: undefined,
        });
      }
    };

    const handleGradingProgress = (event: CustomEvent) => {
      const data = event.detail;
      logInfo("Grading progress update received", data);

      setGradingProgress((prev) => {
        const newProgress = { ...prev };

        // Update based on progress type
        switch (data.type) {
          case "start":
            newProgress.isGrading = true;
            newProgress.currentStep = "Starting grading process";
            newProgress.completedSteps = ["start"];
            newProgress.progress = {
              rubric_name: data.rubric_name,
              standards_count: data.standards_count,
              total_tools: data.total_tools,
            };
            break;

          case "standard_grade":
            newProgress.currentStep = `Grading ${data.standard_name}`;
            newProgress.completedSteps = [
              ...prev.completedSteps,
              `standard_${data.standard_name}`,
            ];
            newProgress.progress.standards_graded =
              (prev.progress.standards_graded || 0) + 1;
            newProgress.latestUpdate = {
              type: "standard_grade",
              message: data.message,
              standard_name: data.standard_name,
              score: data.score,
              feedback_preview: data.feedback_preview,
            };
            break;

          case "strengths":
            newProgress.currentStep = "Identifying strengths";
            newProgress.completedSteps = [...prev.completedSteps, "strengths"];
            newProgress.progress.strengths_count = data.count;
            newProgress.latestUpdate = {
              type: "strengths",
              message: data.message,
            };
            break;

          case "improvements":
            newProgress.currentStep = "Identifying improvements";
            newProgress.completedSteps = [
              ...prev.completedSteps,
              "improvements",
            ];
            newProgress.progress.improvements_count = data.count;
            newProgress.latestUpdate = {
              type: "improvements",
              message: data.message,
            };
            break;

          case "complete":
            newProgress.isGrading = false;
            newProgress.currentStep = "Grading completed";
            newProgress.completedSteps = [...prev.completedSteps, "complete"];
            newProgress.latestUpdate = {
              type: "complete",
              message: data.message,
            };
            break;
        }

        return newProgress;
      });
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
      "gradingProgress",
      handleGradingProgress as EventListener
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
        "gradingProgress",
        handleGradingProgress as EventListener
      );
    };
  }, [chatId, chat?.attempt_id, queryClient, isWaitingForFeedback]);

  // ✅ NEW: Show feedback modal when grading starts or when feedback is available
  useEffect(() => {
    if (!chat) return;

    // Check if feedback exists and we should show it (check both new and old systems)
    const chatWithIncludes = chat as {
      feedback?: unknown[];
      rubric_grades?: unknown[];
    };
    const hasFeedback =
      chatWithIncludes.rubric_grades &&
      chatWithIncludes.rubric_grades.length > 0;

    // Show feedback modal if grading is in progress or feedback is available
    if (
      (gradingProgress.isGrading || hasFeedback) &&
      !lastProcessedFeedbackRef.current
    ) {
      logInfo(
        "Grading in progress or feedback available, showing feedback modal"
      );
      setShowFeedback(true);
      lastProcessedFeedbackRef.current = "feedback";
      // ✅ NEW: Clear loading state for feedback
      setIsWaitingForFeedback(false);
    }
  }, [chat, gradingProgress.isGrading]);

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
  const sendMessage = async (message: string, parentId?: string | null) => {
    if (!message.trim() || sendMessageMutation.isPending || !isTrainingActive) {
      return;
    }

    try {
      // Prefer RTC/websocket pipeline to keep audio path/live events aligned
      try {
        joinRoom(chatId);
      } catch {}
      try {
        setParentCursor(chatId, parentId ?? null);
      } catch {}
      sendWebRTCMessage(chatId, message, parentId ?? undefined);
      logInfo(`Sent training message for chat ${chatId}`);
    } catch (error) {
      logError("Error sending training message:", error);
      throw error;
    }
  };

  const endTraining = async () => {
    if (endTrainingMutation.isPending) return;

    try {
      // ✅ NEW: Set loading state for feedback
      setIsWaitingForFeedback(true);
      await endTrainingMutation.mutateAsync({ chatId });
      logInfo(`Ended training for chat ${chatId}`);
      // Loading state will be cleared when feedback is received via WebSocket event
    } catch (error) {
      // ✅ NEW: Clear loading state on error
      setIsWaitingForFeedback(false);
      logError("Error ending training:", error);
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
    isGettingHints: false, // Will be managed by WebSocket context
    isWaitingForFeedback, // ✅ NEW: Expose loading state for feedback

    // Grading progress state
    gradingProgress, // ✅ NEW: Expose grading progress state

    // Training actions
    sendMessage,
    endTraining,
    getHints,

    // UI state
    currentMessage,
    setCurrentMessage,
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

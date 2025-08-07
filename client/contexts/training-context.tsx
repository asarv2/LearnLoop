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
  useGenerateFeedback,
  useSendTrainingMessage,
  useSubmitAssessment,
  useTrainingMessages,
} from "@/lib/api/hooks/useTrainingMessages";
import { Chat, Message } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import React, { createContext, useContext, useState } from "react";

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
  isGeneratingFeedback: boolean;

  // Training actions
  sendMessage: (message: string) => Promise<void>;
  endTraining: () => Promise<void>;
  submitAssessment: (responses: Record<string, unknown>) => Promise<void>;
  generateFeedback: () => Promise<void>;

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

  // WebSocket connection
  const { isConnected } = useWebSocket();

  // API hooks
  const { data: chat } = useChat(chatId);

  const { data: messages = [] } = useTrainingMessages(chatId);

  const sendMessageMutation = useSendTrainingMessage();
  const endTrainingMutation = useEndTraining();
  const submitAssessmentMutation = useSubmitAssessment();
  const generateFeedbackMutation = useGenerateFeedback();

  // Training status
  const isTrainingActive = chat ? !chat.completed : true;
  const isTrainingCompleted = chat ? chat.completed : false;

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
      await endTrainingMutation.mutateAsync({ chatId });
      logInfo(`Ended training for chat ${chatId}`);
      setShowAssessment(true);
    } catch (error) {
      logError("Error ending training:", error);
      throw error;
    }
  };

  const submitAssessment = async (responses: Record<string, unknown>) => {
    try {
      await submitAssessmentMutation.mutateAsync({
        chatId,
        responses,
      });
      setShowAssessment(false);

      // Generate feedback after assessment
      await generateFeedback();
      setShowFeedback(true);
      logInfo(`Submitted assessment for chat ${chatId}`);
    } catch (error) {
      logError("Error submitting assessment:", error);
      throw error;
    }
  };

  const generateFeedback = async () => {
    try {
      await generateFeedbackMutation.mutateAsync({ chatId });
      logInfo(`Generated feedback for chat ${chatId}`);
    } catch (error) {
      logError("Error generating feedback:", error);
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
    isGeneratingFeedback: generateFeedbackMutation.isPending,

    // Training actions
    sendMessage,
    endTraining,
    submitAssessment,
    generateFeedback,

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

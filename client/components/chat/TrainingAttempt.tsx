/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { useChat } from "@/lib/api/hooks/useChats";
import {
  useEndTraining,
  useGenerateFeedback,
  useSendTrainingMessage,
  useSubmitAssessment,
  useTrainingMessages,
} from "@/lib/api/hooks/useTrainingMessages";
import type { MessageCreate } from "@/lib/repos/messageRepo";
import { Assessment } from "@/types";
import { logError } from "@/utils/logger";
import { Box } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AssessmentWizard from "./AssessmentWizard";
import ChatArea from "./ChatArea";
import ChatHeader from "./ChatHeader";
import FeedbackModal from "./FeedbackModal";
interface TrainingAttemptProps {
  chatId: string;
}

export default function TrainingAttempt({ chatId }: TrainingAttemptProps) {
  const router = useRouter();
  const [currentMessage, setCurrentMessage] = useState("");
  const [showAssessment, setShowAssessment] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the new training hooks
  const { data: chat } = useChat(chatId, [
    "grades",
    "assessment",
    "feedback",
    "hints",
    "messages",
  ]);
  const { data: messages = [], streamingMessage } = useTrainingMessages(chatId);
  const sendMessageMutation = useSendTrainingMessage();
  const endTrainingMutation = useEndTraining();
  const submitAssessmentMutation = useSubmitAssessment();
  const generateFeedbackMutation = useGenerateFeedback();

  // Determine if interview is active based on chat completion status
  const isInterviewActive = chat ? !chat.completed : true;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const sendMessage = async () => {
    if (
      !currentMessage.trim() ||
      sendMessageMutation.isPending ||
      !isInterviewActive
    )
      return;

    const userMessage = currentMessage;
    setCurrentMessage("");

    try {
      await sendMessageMutation.mutateAsync({
        chatId,
        message: userMessage,
        assistantAudioEnabled: false, // TODO: Add audio toggle
      });
    } catch (error) {
      logError("Error sending message:", error);
    }
  };

  const endInterview = async () => {
    if (endTrainingMutation.isPending) return;

    try {
      await endTrainingMutation.mutateAsync({ chatId });
      // Show the assessment wizard after successful end
      setShowAssessment(true);
    } catch (error) {
      logError("Error ending interview:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to end interview: ${errorMessage}. Please check the console for more details.`
      );
    }
  };

  const handleAssessmentComplete = async (
    responses: Assessment["responses"]
  ) => {
    try {
      await submitAssessmentMutation.mutateAsync({
        chatId,
        responses: responses as Record<string, unknown>,
      });
      setShowAssessment(false);

      // Generate feedback after assessment is submitted
      await generateFeedbackMutation.mutateAsync({ chatId });
      setShowFeedback(true);
    } catch (error) {
      logError("Error processing assessment:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to process assessment: ${errorMessage}. Please check the console for more details.`
      );
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Combine regular messages with streaming message for display
  const displayMessages = [...messages];
  if (streamingMessage) {
    displayMessages.push({
      id: streamingMessage.id,
      content: streamingMessage.content,
      role: streamingMessage.role,
      chat_id: streamingMessage.chat_id,
      completed: streamingMessage.completed,
      completed_at: "",
      created_at: streamingMessage.created_at,
      training_id: chat?.training_id || null,
      error: null,
      persona_id: null,
    } as MessageCreate); // Type assertion to fix the mismatch
  }

  return (
    <Box style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <ChatHeader
        candidateName={chat?.name || "John Doe"}
        interviewType={chat?.type || ""}
        resumeId={chat?.resume_id || ""}
        onEndInterview={endInterview}
        isInterviewActive={isInterviewActive}
        isEndingInterview={endTrainingMutation.isPending}
        onShowFeedback={() => setShowFeedback(true)}
        onBack={() => router.push("/dashboard/trainings")}
        interviewStartTimeIso={chat?.created_at}
        completedAtIso={chat?.completed_at}
      />

      <ChatArea
        displayMessages={displayMessages as any}
        isSendingMessage={sendMessageMutation.isPending}
        isEndingInterview={endTrainingMutation.isPending}
        streamingMessage={!!streamingMessage}
        isInterviewActive={isInterviewActive}
        currentMessage={currentMessage}
        setCurrentMessage={setCurrentMessage}
        handleKeyPress={handleKeyPress}
        sendMessage={sendMessage}
        chat={chat!}
        messagesEndRef={messagesEndRef}
      />

      {/* Assessment Wizard */}
      <AssessmentWizard
        isOpen={showAssessment}
        onClose={() => setShowAssessment(false)}
        onComplete={handleAssessmentComplete}
        candidateName={chat?.name || "John Doe"}
        isSubmitting={submitAssessmentMutation.isPending}
        messages={messages as any}
        chat={chat!}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        feedback={chat?.feedback_?.[0] || null}
        candidateName={chat?.name || "John Doe"}
        interviewScore={chat?.interview_scores?.[0] || null}
        chat={chat}
      />
    </Box>
  );
}

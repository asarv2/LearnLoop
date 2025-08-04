/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { TrainingProvider, useTraining } from "@/contexts/training-context";
import { useChatForAttempt } from "@/lib/api/hooks/useChats";
import { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import { Assessment } from "@/types";
import { logError } from "@/utils/logger";
import { Box, Text } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import AssessmentWizard from "./AssessmentWizard";
import ChatArea from "./ChatArea";
import ChatHeader from "./ChatHeader";
import FeedbackModal from "./FeedbackModal";

interface TrainingAttemptProps {
  attemptId: string;
  trainingId: string;
}

function TrainingAttemptContent() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the training context for all training-related state and actions
  const {
    chat,
    messages,
    streamingMessage,
    isSendingMessage,
    isEndingTraining,
    isSubmittingAssessment,
    isTrainingActive,
    currentMessage,
    setCurrentMessage,
    showAssessment,
    setShowAssessment,
    showFeedback,
    setShowFeedback,
    endTraining,
    submitAssessment,
  } = useTraining();

  // Helper function to get assessment ID
  const getAssessmentId = () => {
    if (!chat) return "";
    const chatWithIncludes = chat as ChatWithAllIncludes;
    return chatWithIncludes.assessments?.[0]?.id || "";
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const endInterview = async () => {
    try {
      await endTraining();
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
      await submitAssessment(responses as Record<string, unknown>);
    } catch (error) {
      logError("Error processing assessment:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to process assessment: ${errorMessage}. Please check the console for more details.`
      );
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
    });
  }

  return (
    <Box style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {!chat ? (
        <Box
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <Text>Loading chat...</Text>
        </Box>
      ) : (
        <>
          <ChatHeader
            candidateName={chat?.name || "John Doe"}
            interviewType={chat?.type || ""}
            resumeId={chat?.resume_id || ""}
            onEndInterview={endInterview}
            isInterviewActive={isTrainingActive}
            isEndingInterview={isEndingTraining}
            onShowFeedback={() => setShowFeedback(true)}
            onBack={() => router.push("/dashboard/trainings")}
            interviewStartTimeIso={chat?.created_at}
            completedAtIso={chat?.completed_at}
          />

          <ChatArea
            displayMessages={displayMessages}
            isSendingMessage={isSendingMessage}
            isEndingInterview={isEndingTraining}
            streamingMessage={!!streamingMessage}
            isInterviewActive={isTrainingActive}
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            chat={chat}
            messagesEndRef={messagesEndRef}
          />

          {/* Assessment Wizard */}
          <AssessmentWizard
            isOpen={showAssessment}
            onClose={() => setShowAssessment(false)}
            onComplete={handleAssessmentComplete}
            candidateName={chat?.name || "John Doe"}
            isSubmitting={isSubmittingAssessment}
            assessmentId={getAssessmentId()}
            chat={chat}
          />

          {/* Feedback Modal */}
          <FeedbackModal
            isOpen={showFeedback}
            onClose={() => setShowFeedback(false)}
            feedback={(chat as ChatWithAllIncludes)?.feedback?.[0] || null}
            candidateName={chat?.name || "John Doe"}
            interviewScore={null}
            chat={chat}
          />
        </>
      )}
    </Box>
  );
}

export default function TrainingAttempt({ attemptId }: TrainingAttemptProps) {
  const { data: chat, isLoading } = useChatForAttempt(attemptId);
  const chatId = chat?.id;

  // Show loading state while fetching chat data
  if (isLoading || !chatId) {
    return (
      <Box
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Text>Loading chat...</Text>
      </Box>
    );
  }

  // Only render the TrainingProvider once we have a stable chatId
  return (
    <TrainingProvider chatId={chatId}>
      <TrainingAttemptContent />
    </TrainingProvider>
  );
}

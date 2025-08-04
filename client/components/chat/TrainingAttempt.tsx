/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { useChatForAttempt } from "@/lib/api/hooks/useChats";
import {
  useEndTraining,
  useGenerateFeedback,
  useSendTrainingMessage,
  useSubmitAssessment,
  useTrainingMessages,
} from "@/lib/api/hooks/useTrainingMessages";
import { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import { Assessment } from "@/types";
import { logError } from "@/utils/logger";
import { Box, Text } from "@radix-ui/themes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AssessmentWizard from "./AssessmentWizard";
import ChatArea from "./ChatArea";
import ChatHeader from "./ChatHeader";
import FeedbackModal from "./FeedbackModal";

interface TrainingAttemptProps {
  attemptId: string;
  trainingId: string;
}

export default function TrainingAttempt({
  attemptId,
}: TrainingAttemptProps) {
  const router = useRouter();
  const [currentMessage, setCurrentMessage] = useState("");
  const [showAssessment, setShowAssessment] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the new hook to get the most recent incomplete chat for this attempt
  const { data: chat } = useChatForAttempt(attemptId);
  const chatId = chat?.id;

  // Use the new training hooks
  const { data: messages = [], streamingMessage } = useTrainingMessages(
    chatId!,
    !!chatId
  );
  const sendMessageMutation = useSendTrainingMessage();
  const endTrainingMutation = useEndTraining();
  const submitAssessmentMutation = useSubmitAssessment();
  const generateFeedbackMutation = useGenerateFeedback();

  // Helper function to get assessment ID
  const getAssessmentId = () => {
    if (!chat) return "";
    const chatWithIncludes = chat as ChatWithAllIncludes;
    return chatWithIncludes.assessments?.[0]?.id || "";
  };

  // Determine if interview is active based on chat completion status
  const isInterviewActive = chat ? !chat.completed : true;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const endInterview = async () => {
    if (endTrainingMutation.isPending || !chatId) return;

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
    if (!chatId) return;

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
            isInterviewActive={isInterviewActive}
            isEndingInterview={endTrainingMutation.isPending}
            onShowFeedback={() => setShowFeedback(true)}
            onBack={() => router.push("/dashboard/trainings")}
            interviewStartTimeIso={chat?.created_at}
            completedAtIso={chat?.completed_at}
          />

          <ChatArea
            displayMessages={displayMessages}
            isSendingMessage={sendMessageMutation.isPending}
            isEndingInterview={endTrainingMutation.isPending}
            streamingMessage={!!streamingMessage}
            isInterviewActive={isInterviewActive}
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
            isSubmitting={submitAssessmentMutation.isPending}
            assessmentId={getAssessmentId()}
            chat={chat}
          />

          {/* Feedback Modal */}
          <FeedbackModal
            isOpen={showFeedback}
            onClose={() => setShowFeedback(false)}
            feedback={chat?.feedback?.[0] || null}
            candidateName={chat?.name || "John Doe"}
            interviewScore={null}
            chat={chat}
          />
        </>
      )}
    </Box>
  );
}

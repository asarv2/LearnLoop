/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { TrainingProvider, useTraining } from "@/contexts/training-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { useChatForAttempt } from "@/lib/api/hooks/useChats";
import { useFields } from "@/lib/api/hooks/useFields";
import { useParameters } from "@/lib/api/hooks/useParameters";
import { useScenario } from "@/lib/api/hooks/useScenarios";
import { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import { logError } from "@/utils/logger";
import { Box, Text } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AssessmentWizard from "./AssessmentWizard";
import ChatArea from "./ChatArea";
import ChatHeader from "./ChatHeader";
import FeedbackModal from "./FeedbackModal";
import IntroMessageModal from "./IntroMessageModal";

interface TrainingAttemptProps {
  attemptId: string;
}

function TrainingAttemptContent() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [hasShownIntroModal, setHasShownIntroModal] = useState(false);

  // WebSocket intro message sender (normal send path under the hood)
  const { emitSendIntroMessage } = useWebSocket();

  // Use the training context for all training-related state and actions
  const {
    chat,
    messages,
    isSendingMessage,
    isEndingTraining,
    isSubmittingAssessment,
    isWaitingForAssessment, // ✅ NEW: Loading state while waiting for assessment
    isWaitingForFeedback, // ✅ NEW: Loading state while waiting for feedback
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

  // Get scenario data from the chat's scenario_id (the authoritative source)
  const scenarioId: string | undefined = chat?.scenario_id || undefined;
  const { data: scenarioData } = useScenario(
    scenarioId || "",
    Boolean(scenarioId)
  );

  // Transform scenario data to match ChatHeader's expected format
  const scenario = useMemo(() => {
    if (!scenarioData) return null;
    return {
      title: scenarioData.title,
      problem_statement: scenarioData.problem_statement || null,
      objectives: scenarioData.objectives || [],
    };
  }, [scenarioData]);

  // Helper function to get assessment ID
  const getAssessmentId = () => {
    if (!chat) return "";
    const chatWithIncludes = chat as ChatWithAllIncludes;
    return chatWithIncludes.assessments?.[0]?.id || "";
  };

  // Helper function to check if assessment exists for this chat
  const hasAssessment = () => {
    if (!chat) return false;
    const chatWithIncludes = chat as ChatWithAllIncludes;
    return (
      chatWithIncludes.assessments && chatWithIncludes.assessments.length > 0
    );
  };

  // Helper function to check if feedback exists for this chat
  const hasFeedback = () => {
    if (!chat) return false;
    const chatWithIncludes = chat as ChatWithAllIncludes;
    return chatWithIncludes.feedback && chatWithIncludes.feedback.length > 0;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Show intro modal when chat loads and there are no messages (only once)
  useEffect(() => {
    if (chat && messages && messages.length === 0 && !hasShownIntroModal) {
      setShowIntroModal(true);
      setHasShownIntroModal(true);
    }
  }, [chat, messages, hasShownIntroModal]);

  const handleIntroMessageSelect = (message: string) => {
    console.log(
      "TrainingAttempt received intro message:",
      message,
      "chat?.id:",
      chat?.id
    );
    if (chat?.id) {
      console.log("Calling emitSendIntroMessage with:", {
        chat_id: chat.id,
        message,
      });
      emitSendIntroMessage({
        chat_id: chat.id,
        message,
      });
      setShowIntroModal(false);
    } else {
      console.error("No chat ID available for intro message");
    }
  };

  const handleCloseIntroModal = () => {
    setShowIntroModal(false);
    // User can close modal and type their own message
  };

  const endInterview = async () => {
    try {
      await endTraining();
      // Modal state management is now handled by WebSocket events in the training context
      // No need to manually set showAssessment or showFeedback here
    } catch (error) {
      logError("Error ending interview:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to end interview: ${errorMessage}. Please check the console for more details.`
      );
    }
  };

  const handleAssessmentComplete = async (responses: unknown) => {
    try {
      await submitAssessment(responses as Record<string, unknown>);
      // Modal state management is now handled by WebSocket events in the training context
      // No need to manually set showFeedback here
    } catch (error) {
      logError("Error processing assessment:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to process assessment: ${errorMessage}. Please check the console for more details.`
      );
    }
  };

  // 👇 DEPRECATED: The complex message merging logic is gone!
  // The `messages` array from the context is always the single source of truth.
  const displayMessages = messages;

  // Compute document field info (document id and field name) from parameters
  const { data: fields } = useFields();
  const { data: allParameters } = useParameters();
  const queryClient = useQueryClient();
  const { documentId, documentFieldName } = useMemo(() => {
    if (!chat || !chat.parameter_ids || !fields || !allParameters) {
      return {
        documentId: undefined as string | undefined,
        documentFieldName: undefined as string | undefined,
      };
    }
    const parameterSet = new Set(chat.parameter_ids);
    const paramsForChat = allParameters.filter(
      (p) => p.id && parameterSet.has(p.id)
    );
    for (const p of paramsForChat) {
      const field = fields.find((f) => f.id === p.field_id);
      if (field && field.field_type === "document" && p.value) {
        return {
          documentId: p.value as string,
          documentFieldName: field.name as string,
        };
      }
    }
    return {
      documentId: undefined as string | undefined,
      documentFieldName: undefined as string | undefined,
    };
  }, [chat, fields, allParameters]);

  // If the document isn't immediately available, re-fetch chat/parameters shortly after mount
  useEffect(() => {
    if (!chat?.id || documentId) return;
    const t = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["chat", chat.id] });
      queryClient.invalidateQueries({ queryKey: ["parameters"] });
      queryClient.invalidateQueries({ queryKey: ["fields"] });
    }, 600);
    return () => clearTimeout(t);
  }, [chat?.id, documentId, queryClient]);

  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 96px)",
        overflow: "hidden",
      }}
    >
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
            onEndInterview={endInterview}
            isInterviewActive={isTrainingActive}
            isEndingInterview={isEndingTraining || isWaitingForAssessment} // ✅ NEW: Show loading while waiting for assessment
            onShowFeedback={() => setShowFeedback(true)}
            onShowAssessment={() => setShowAssessment(true)}
            onBack={() => router.push("/dashboard/trainings")}
            interviewStartTimeIso={chat?.created_at}
            completedAtIso={chat?.completed_at}
            scenario={scenario}
            hasAssessment={hasAssessment()}
            hasFeedback={hasFeedback()}
            documentId={documentId}
            documentFieldName={documentFieldName}
          />

          <ChatArea
            displayMessages={displayMessages}
            isSendingMessage={isSendingMessage}
            isEndingInterview={isEndingTraining}
            isInterviewActive={isTrainingActive}
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            chat={chat}
            messagesEndRef={messagesEndRef}
          />

          {/* Assessment Wizard - only show if assessment exists */}
          {hasAssessment() && (
            <AssessmentWizard
              isOpen={showAssessment}
              onClose={() => setShowAssessment(false)}
              onComplete={handleAssessmentComplete}
              isSubmitting={isSubmittingAssessment || isWaitingForFeedback} // ✅ NEW: Show loading while waiting for feedback
              assessmentId={getAssessmentId()}
              chat={chat}
            />
          )}

          {/* Feedback Modal - only show if feedback exists */}
          {hasFeedback() && (
            <FeedbackModal
              isOpen={showFeedback}
              onClose={() => setShowFeedback(false)}
              feedback={(chat as ChatWithAllIncludes)?.feedback?.[0] || null}
              score={null}
              chat={chat}
            />
          )}

          {/* Intro Message Modal */}
          <IntroMessageModal
            isOpen={showIntroModal}
            onClose={handleCloseIntroModal}
            onSelectMessage={handleIntroMessageSelect}
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

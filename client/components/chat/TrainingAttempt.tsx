/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { TrainingProvider, useTraining } from "@/contexts/training-context";
import { useChatForAttempt } from "@/lib/api/hooks/useChats";
import { useFields } from "@/lib/api/hooks/useFields";
import { useParameters } from "@/lib/api/hooks/useParameters";
import { useScenario } from "@/lib/api/hooks/useScenarios";
import { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import { logError } from "@/utils/logger";
import { Box, Text } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import ChatArea from "./ChatArea";
import ChatHeader from "./ChatHeader";
import FeedbackModal from "./FeedbackModal";

interface TrainingAttemptProps {
  attemptId: string;
}

function TrainingAttemptContent() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use the training context for all training-related state and actions
  const {
    chat,
    messages,
    isSendingMessage,
    isEndingTraining,
    isWaitingForFeedback, // ✅ NEW: Loading state while waiting for feedback
    isTrainingActive,
    isTrainingCompleted,
    currentMessage,
    setCurrentMessage,
    showFeedback,
    setShowFeedback,
    endTraining,
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
            onEndSession={endInterview}
            isSessionActive={isTrainingActive}
            isEndingSession={isEndingTraining || isWaitingForFeedback} // ✅ NEW: Show loading while waiting for feedback
            onShowFeedback={() => setShowFeedback(true)}
            onBack={() => router.push("/dashboard/trainings")}
            sessionStartTimeIso={chat?.created_at}
            completedAtIso={chat?.completed_at}
            scenario={scenario}
            hasFeedback={hasFeedback()}
            documentId={documentId}
            documentFieldName={documentFieldName}
            isCompleted={isTrainingCompleted}
            onRetryEnding={endTraining}
          />

          <ChatArea
            displayMessages={displayMessages}
            isSendingMessage={isSendingMessage}
            isEndingSession={isEndingTraining}
            isSessionActive={isTrainingActive}
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            chat={chat}
            messagesEndRef={messagesEndRef}
            onShowFeedback={() => setShowFeedback(true)}
          />

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

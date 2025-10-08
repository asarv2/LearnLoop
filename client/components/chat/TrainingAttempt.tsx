/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { TrainingProvider, useTraining } from "@/contexts/training-context";
import { useChatForAttempt } from "@/lib/api/hooks/useChats";
import { useDocuments } from "@/lib/api/hooks/useDocuments";
import { useFields } from "@/lib/api/hooks/useFields";
import { useParameters } from "@/lib/api/hooks/useParameters";
import { useScenario } from "@/lib/api/hooks/useScenarios";
import { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import { logError } from "@/utils/logger";
import { EyeOpenIcon } from "@radix-ui/react-icons";
import { Box, Button, Select, Text } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatArea from "./ChatArea";
import ChatHeader from "./ChatHeader";
import DocumentViewerModal from "./DocumentViewerModal";
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
    gradingProgress, // ✅ NEW: Grading progress state
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

  // Fetch all documents to get their titles
  const { data: allDocuments } = useDocuments();

  // Document viewer state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [isDocumentPanelCollapsed, setIsDocumentPanelCollapsed] =
    useState(false);

  // Get document_ids from scenario data
  const documentIds = useMemo(
    () => scenarioData?.document_ids || [],
    [scenarioData?.document_ids]
  );

  // Create a memoized map for document lookup
  const documentMap = useMemo(() => {
    if (!allDocuments) return new Map<string, { title: string; id: string }>();
    return new Map(
      allDocuments.map((doc) => [doc.id, { title: doc.title, id: doc.id }])
    );
  }, [allDocuments]);

  // Set the first document as selected by default when documents are available
  useEffect(() => {
    if (documentIds.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(documentIds[0]);
    }
  }, [documentIds, selectedDocumentId]);

  // Handle document selection
  const handleDocumentSelect = useCallback((documentId: string) => {
    setSelectedDocumentId(documentId);
  }, []);

  const handleCloseDocumentModal = useCallback(() => {
    setShowDocumentModal(false);
  }, []);

  // Handle document panel collapse
  const handleToggleDocumentPanel = useCallback(() => {
    setIsDocumentPanelCollapsed((prev) => !prev);
  }, []);

  // Helper function to build PDF URL with proper zoom parameters
  const buildPdfUrl = useCallback((id: string) => {
    return `/api/v1/documents/${id}/file#page=1&zoom=page-width`;
  }, []);

  // Helper function to check if feedback exists for this chat
  const hasFeedback = () => {
    if (!chat) return false;
    const chatWithIncludes = chat as ChatWithAllIncludes;
    // Check for rubric_grades
    const hasRubricGrades =
      chatWithIncludes.rubric_grades &&
      chatWithIncludes.rubric_grades.length > 0;

    return hasRubricGrades;
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
        height: "calc(100vh - 180px)",
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
            flex: 1,
          }}
        >
          <Text>Loading chat...</Text>
        </Box>
      ) : (
        <>
          {/* Left Column - Chat Area */}
          <Box
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ChatHeader
              onEndSession={endInterview}
              isSessionActive={isTrainingActive}
              isEndingSession={isEndingTraining || isWaitingForFeedback}
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
              hasDocuments={documentIds.length > 0}
              isDocumentPanelCollapsed={isDocumentPanelCollapsed}
              onToggleDocumentPanel={handleToggleDocumentPanel}
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
            />
          </Box>

          {/* Right Column - Document Viewer */}
          {documentIds.length > 0 && !isDocumentPanelCollapsed && (
            <Box
              style={{
                width: "400px",
                height: "100%",
                borderLeft: "1px solid var(--gray-6)",
                background: "var(--gray-1)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Document Selector Header */}
              <Box
                style={{
                  padding: "16px",
                  borderBottom: "1px solid var(--gray-6)",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <Box style={{ flex: 1 }}>
                  {documentIds.length > 1 ? (
                    <Select.Root
                      value={selectedDocumentId || ""}
                      onValueChange={handleDocumentSelect}
                    >
                      <Select.Trigger
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          border: "1px solid var(--gray-6)",
                        }}
                      />
                      <Select.Content>
                        {documentIds.map((docId) => {
                          const doc = documentMap.get(docId);
                          return (
                            <Select.Item key={docId} value={docId}>
                              {doc?.title || `Document ${docId.slice(0, 8)}...`}
                            </Select.Item>
                          );
                        })}
                      </Select.Content>
                    </Select.Root>
                  ) : (
                    <Text size="2" style={{ color: "var(--gray-11)" }}>
                      {documentMap.get(documentIds[0])?.title || "Document"}
                    </Text>
                  )}
                </Box>
                {selectedDocumentId && (
                  <Button
                    variant="ghost"
                    size="2"
                    onClick={() => setShowDocumentModal(true)}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    title="View document in full screen"
                  >
                    <EyeOpenIcon width="16" height="16" />
                  </Button>
                )}
              </Box>

              {/* Document Preview */}
              {selectedDocumentId && (
                <Box
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    padding: "8px 8px 8px 8px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      flex: 1,
                      background: "white",
                      border: "1px solid var(--gray-6)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      position: "relative",
                      minWidth: 0,
                      minHeight: 0,
                    }}
                  >
                    <iframe
                      src={buildPdfUrl(selectedDocumentId)}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        border: "none",
                        overflow: "hidden",
                      }}
                      title={
                        documentMap.get(selectedDocumentId)?.title || "Document"
                      }
                      loading="lazy"
                    />
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Feedback Modal - show if grading is in progress or feedback exists */}
          {(gradingProgress.isGrading || hasFeedback()) && (
            <FeedbackModal
              isOpen={showFeedback}
              onClose={() => setShowFeedback(false)}
              score={null}
              chat={chat}
              gradingProgress={gradingProgress}
            />
          )}

          {/* Document Viewer Modal */}
          {selectedDocumentId && (
            <DocumentViewerModal
              isOpen={showDocumentModal}
              onClose={handleCloseDocumentModal}
              documentId={selectedDocumentId}
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

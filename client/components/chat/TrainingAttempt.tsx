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
import { Box, Text } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // Fetch all documents to get their titles
  const { data: allDocuments } = useDocuments();

  // Document viewer state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [documentPanelWidth, setDocumentPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [isDocumentPanelCollapsed, setIsDocumentPanelCollapsed] =
    useState(false);

  // Refs for performance optimization
  const panelRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startWidthRef = useRef<number>(400);
  const pendingWidthRef = useRef<number>(400);
  const rafIdRef = useRef<number | null>(null);

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

  // Handle document panel collapse
  const handleToggleDocumentPanel = useCallback(() => {
    setIsDocumentPanelCollapsed((prev) => !prev);
  }, []);

  // Optimized pointer event handlers for resizing
  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      // capture so we still get move events if pointer leaves handle
      (e.target as Element).setPointerCapture(e.pointerId);
      setIsResizing(true);

      // establish starting width & limits for the 30% cap
      startWidthRef.current =
        panelRef.current?.offsetWidth ?? documentPanelWidth;

      // make iframe cheap during drag
      if (iframeRef.current) {
        iframeRef.current.style.pointerEvents = "none";
        iframeRef.current.style.visibility = "hidden"; // optional; remove if you want it visible while dragging
      }

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [documentPanelWidth]
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      // panel is on the right; compute width from the right edge
      const vw = window.innerWidth;
      const tentative = vw - e.clientX;

      const minWidth = 300;
      const hardMax = Math.min(800, vw * 0.6);

      // "30% over" the starting width
      const maxOver = startWidthRef.current * 1.3;
      const maxWidth = Math.min(maxOver, hardMax);

      const clamped = Math.max(minWidth, Math.min(maxWidth, tentative));
      pendingWidthRef.current = clamped;

      // rAF throttle: write to style, avoid React renders per move
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (panelRef.current) {
            panelRef.current.style.width = `${pendingWidthRef.current}px`;
          }
        });
      }
    },
    [isResizing]
  );

  const onResizeEnd = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Commit once to React state to keep it the single source of truth
    setDocumentPanelWidth(pendingWidthRef.current);

    // restore iframe interactivity
    if (iframeRef.current) {
      iframeRef.current.style.pointerEvents = "";
      iframeRef.current.style.visibility = ""; // optional
    }

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [isResizing]);

  // Helper function to check if feedback exists for this chat
  const hasFeedback = () => {
    if (!chat) return false;
    const chatWithIncludes = chat as ChatWithAllIncludes;
    return chatWithIncludes.feedback && chatWithIncludes.feedback.length > 0;
  };

  // Use non-smooth scroll while resizing to avoid competing animations
  const scrollToBottom = useCallback(() => {
    const behavior = isResizing ? "auto" : "smooth";
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [isResizing]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      ref={containerRef}
      style={{
        display: "flex",
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
              onShowFeedback={() => setShowFeedback(true)}
            />
          </Box>

          {/* Right Column - Document Viewer */}
          {documentIds.length > 0 && !isDocumentPanelCollapsed && (
            <>
              {/* Resize Handle (Pointer Events) */}
              <Box
                onPointerDown={onResizeStart}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeEnd}
                style={{
                  width: 6,
                  background: isResizing ? "var(--blue-6)" : "var(--gray-6)",
                  cursor: "col-resize",
                  touchAction: "none", // important for touch
                  transition: isResizing
                    ? "none"
                    : "background-color 0.2s ease",
                }}
              />

              {/* Right Panel */}
              <Box
                ref={panelRef}
                // Keep React state as the authoritative width for first render / after commit
                style={{
                  width: `${documentPanelWidth}px`,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  // isolate layout/paint so the chat column doesn't reflow
                  contain: "layout paint size",
                  // optional hint; modern Chromium/WebKit ship it
                  contentVisibility: "auto",
                }}
              >
                {selectedDocumentId && (
                  <iframe
                    ref={iframeRef}
                    src={`/api/v1/documents/${selectedDocumentId}/file`}
                    title={
                      documentMap.get(selectedDocumentId)?.title || "Document"
                    }
                    loading="eager"
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      flex: 1,
                      // prevent subpixel jitter during rapid width writes
                      willChange: "width",
                    }}
                  />
                )}
              </Box>
            </>
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

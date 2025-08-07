// lib/api/hooks/useTrainingMessages.ts
import { useWebSocket } from "@/contexts/websocket-context";
import { Message } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../fetcher";

// Streaming message interface
export interface StreamingMessage {
  id: string;
  content: string;
  completed: boolean;
  role: "assistant";
  chat_id: string;
  created_at: string;
}

// Define query keys for training messages
export const trainingMessageKeys = {
  list: (chatId: string) => ["training-messages", chatId] as const,
  streaming: (chatId: string) =>
    ["training-messages-streaming", chatId] as const,
};

// Hook to manage training messages with WebSocket integration
export function useTrainingMessages(chatId: string, enabled = true) {
  const queryClient = useQueryClient();
  const { isConnected, joinRoom, leaveRoom } = useWebSocket();
  const joinedRef = useRef(false); // Track if we've joined to prevent duplicates

  // Query for fetching initial messages
  const query = useQuery({
    queryKey: trainingMessageKeys.list(chatId),
    queryFn: () => api<Message[]>(`/api/v1/messages?chat_id=${chatId}`),
    enabled: enabled && !!chatId,
    staleTime: 30_000, // 30 seconds
  });

  // Join the training room when component mounts or chatId changes
  useEffect(() => {
    if (!chatId || !isConnected) return;

    if (!joinedRef.current) {
      // Join only first time
      logInfo(`Joining training room: ${chatId}`);
      joinRoom(chatId);
      joinedRef.current = true;
    }

    return () => {
      if (joinedRef.current) {
        // Leave only if we really joined
        logInfo(`Leaving training room: ${chatId}`);
        leaveRoom(chatId);
        joinedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isConnected]);

  // Listen for WebSocket message events
  useEffect(() => {
    const handleTrainingMessageStart = (event: CustomEvent) => {
      if (event.detail.chatId === chatId) {
        logInfo(`Training message started for chat ${chatId}`);
        // Optionally update loading state
      }
    };

    const handleTrainingMessageToken = (event: CustomEvent) => {
      if (event.detail.chatId === chatId) {
        // Update the streaming message with new token
        queryClient.setQueryData(trainingMessageKeys.streaming(chatId), {
          id: event.detail.messageId,
          content: event.detail.accumulatedContent,
          completed: false,
          role: "assistant" as const,
          chat_id: chatId,
          created_at: new Date().toISOString(),
        });
      }
    };

    const handleTrainingMessageComplete = (event: CustomEvent) => {
      if (event.detail.chatId === chatId) {
        logInfo(`Training message completed for chat ${chatId}`);

        // Clear streaming message
        queryClient.setQueryData(trainingMessageKeys.streaming(chatId), null);

        // Invalidate messages to refetch with the completed message
        queryClient.invalidateQueries({
          queryKey: trainingMessageKeys.list(chatId),
        });
      }
    };

    const handleTrainingMessageError = (event: CustomEvent) => {
      if (event.detail.chatId === chatId) {
        logError(
          `Training message error for chat ${chatId}:`,
          event.detail.error
        );

        // Clear streaming message on error
        queryClient.setQueryData(trainingMessageKeys.streaming(chatId), null);

        // Invalidate messages to ensure consistency
        queryClient.invalidateQueries({
          queryKey: trainingMessageKeys.list(chatId),
        });
      }
    };

    const handleUserMessageSaved = (event: CustomEvent) => {
      if (event.detail.chatId === chatId) {
        logInfo(`User message saved for chat ${chatId}, updating cache.`);

        // Invalidate the query to refetch messages from the server.
        // This is the simplest and most reliable way to ensure the UI
        // reflects the true state of the database, replacing the
        // optimistic message with the real one.
        queryClient.invalidateQueries({
          queryKey: trainingMessageKeys.list(chatId),
        });
      }
    };

    // Add event listeners
    window.addEventListener(
      "trainingMessageStart",
      handleTrainingMessageStart as EventListener
    );
    window.addEventListener(
      "trainingMessageToken",
      handleTrainingMessageToken as EventListener
    );
    window.addEventListener(
      "trainingMessageComplete",
      handleTrainingMessageComplete as EventListener
    );
    window.addEventListener(
      "trainingMessageError",
      handleTrainingMessageError as EventListener
    );
    window.addEventListener(
      "userMessageSaved",
      handleUserMessageSaved as EventListener
    );

    return () => {
      // Remove event listeners
      window.removeEventListener(
        "trainingMessageStart",
        handleTrainingMessageStart as EventListener
      );
      window.removeEventListener(
        "trainingMessageToken",
        handleTrainingMessageToken as EventListener
      );
      window.removeEventListener(
        "trainingMessageComplete",
        handleTrainingMessageComplete as EventListener
      );
      window.removeEventListener(
        "trainingMessageError",
        handleTrainingMessageError as EventListener
      );
      window.removeEventListener(
        "userMessageSaved",
        handleUserMessageSaved as EventListener
      );
    };
  }, [chatId, queryClient]);

  // Get streaming message
  const streamingMessage = useQuery<StreamingMessage | null>({
    queryKey: trainingMessageKeys.streaming(chatId),
    queryFn: () => null, // This is managed by WebSocket events
    enabled: false, // Never fetch, only updated by events
    initialData: null,
  });

  return {
    ...query,
    streamingMessage: streamingMessage.data,
    isConnected,
  };
}

// Hook for sending training messages
export function useSendTrainingMessage() {
  const { emitSendTrainingMessage } = useWebSocket();

  return useMutation({
    mutationFn: async ({
      chatId,
      message,
    }: {
      chatId: string;
      message: string;
    }) => {
      emitSendTrainingMessage({ chat_id: chatId, message });
      return { success: true };
    },
    onError: (error) => {
      logError("Error sending training message:", error);
    },
  });
}

// Hook for ending training
export function useEndTraining() {
  const { emitEndTraining } = useWebSocket();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      emitEndTraining({ chat_id: chatId });
      return { success: true };
    },
    onSuccess: (_, { chatId }) => {
      // Invalidate chat queries to reflect completion status
      queryClient.invalidateQueries({
        queryKey: ["chat", chatId],
      });
    },
    onError: (error) => {
      logError("Error ending training:", error);
    },
  });
}

// Hook for submitting assessment
export function useSubmitAssessment() {
  const { emitSubmitAssessment } = useWebSocket();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chatId,
      responses,
    }: {
      chatId: string;
      responses: Record<string, unknown>;
    }) => {
      emitSubmitAssessment({
        chat_id: chatId,
        responses,
      });
      return { success: true };
    },
    onSuccess: (_, { chatId }) => {
      // Invalidate assessment and feedback queries
      queryClient.invalidateQueries({
        queryKey: ["assessment", chatId],
      });
      queryClient.invalidateQueries({
        queryKey: ["feedback", chatId],
      });
    },
    onError: (error) => {
      logError("Error submitting assessment:", error);
    },
  });
}

// Hook for generating feedback
export function useGenerateFeedback() {
  const { emitGenerateFeedback } = useWebSocket();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      emitGenerateFeedback({ chat_id: chatId });
      return { success: true };
    },
    onSuccess: (_, { chatId }) => {
      // Invalidate feedback queries
      queryClient.invalidateQueries({
        queryKey: ["feedback", chatId],
      });
    },
    onError: (error) => {
      logError("Error generating feedback:", error);
    },
  });
}

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
  const joinedRef = useRef(false);
  // ✅ FIX: Use ref to persist accumulatedUserTranscript across re-renders
  const accumulatedUserTranscriptRef = useRef("");

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
  }, [chatId, isConnected, joinRoom, leaveRoom]);

  // ✨ OPTIMIZATION: This useEffect is now much smarter and more performant.
  useEffect(() => {
    const queryKey = trainingMessageKeys.list(chatId);

    // --- AI Message Handlers ---
    const handleTrainingMessageStart = (event: CustomEvent) => {
      if (event.detail.chatId !== chatId) return;
      logInfo(`AI message started, adding placeholder.`);

      // ✅ FIX: The server has started a response. Add a new placeholder
      // for the assistant to the end of the message list. This is the
      // new, correct way to show the "is thinking..." message.
      queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
        // Prevent adding duplicate placeholders if event fires multiple times
        if (old.some((msg) => msg.id === event.detail.messageId)) {
          return old;
        }

        const newAssistantMessage: Message = {
          id: event.detail.messageId, // Use the REAL ID from the server
          persona_id: event.detail.personaId, // Use the REAL persona_id
          role: "assistant",
          content: "", // Starts blank, will be filled by tokens
          completed: false,
          created_at: new Date().toISOString(),
          chat_id: chatId,
          completed_at: "",
          error: null,
          training_id: null,
        };

        return [...old, newAssistantMessage];
      });
    };

    const handleTrainingMessageToken = (event: CustomEvent) => {
      if (event.detail.chatId !== chatId) return;

      // ❌ Comment out this line to stop the log spam
      // logInfo("Dispatching training message token event", { ... });

      // Find the streaming message and append the token
      queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
        old.map((msg) =>
          msg.id === event.detail.messageId
            ? { ...msg, content: event.detail.accumulatedContent }
            : msg
        )
      );
    };

    const handleTrainingMessageComplete = (event: CustomEvent) => {
      if (event.detail.chatId !== chatId) return;
      logInfo(`AI message completed: ${event.detail.messageId}`);

      // Find the message and mark it as complete
      queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
        old.map((msg) =>
          msg.id === event.detail.messageId
            ? { ...msg, content: event.detail.finalContent, completed: true }
            : msg
        )
      );
    };

    // --- User Message Handler ---
    const handleUserMessageSaved = (event: CustomEvent) => {
      if (event.detail.chatId !== chatId) return;
      const realMessage: Message = event.detail.message;
      logInfo("User message saved, replacing optimistic voice message.");

      // ✅ FIX: Reset the accumulated transcript for the next turn
      accumulatedUserTranscriptRef.current = "";

      queryClient.setQueryData<Message[]>(queryKey, (old = []) => {
        // Find and replace the optimistic voice placeholder
        const updatedList = old.map((msg) =>
          msg.id.startsWith("temp-voice-") && !msg.completed
            ? realMessage // Replace placeholder with the real message from the server
            : msg
        );

        // This check handles text messages, which don't have a voice placeholder
        // If no voice placeholder was found, it means it's likely a text message update.
        const wasReplaced = updatedList.some(
          (msg) => msg.id === realMessage.id
        );
        if (!wasReplaced) {
          return old.map((msg) =>
            msg.id.startsWith("temp-") && !msg.id.startsWith("temp-assistant-")
              ? realMessage
              : msg
          );
        }

        return updatedList;
      });
    };

    // ✅ FIX: Add a new handler for the user's live transcript
    const handleUserTranscriptDelta = (event: CustomEvent) => {
      if (event.detail.chatId !== chatId) return;

      // ✅ FIX: Use the ref to accumulate transcript
      accumulatedUserTranscriptRef.current += event.detail.delta;

      queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
        old.map((msg) =>
          msg.id.startsWith("temp-voice-") && !msg.completed
            ? { ...msg, content: accumulatedUserTranscriptRef.current + "..." } // Update content
            : msg
        )
      );
    };

    const handleTrainingMessageError = (event: CustomEvent) => {
      if (event.detail.chatId !== chatId) return;
      logError("Streaming error, removing placeholder.", event.detail.error);

      // ✅ FIX: On error, remove the incomplete assistant message
      // This works for both optimistic placeholders and real messages
      queryClient.setQueryData<Message[]>(queryKey, (old = []) =>
        old.filter((msg) => msg.id !== event.detail.messageId)
      );
    };

    // Add event listeners
    window.addEventListener(
      "userMessageSaved",
      handleUserMessageSaved as EventListener
    );
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
      "userTranscriptDelta",
      handleUserTranscriptDelta as EventListener
    );

    return () => {
      // Remove event listeners
      window.removeEventListener(
        "userMessageSaved",
        handleUserMessageSaved as EventListener
      );
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
        "userTranscriptDelta",
        handleUserTranscriptDelta as EventListener
      );
    };
  }, [chatId, queryClient]);

  // 👇 DEPRECATED: We no longer need a separate streaming message query.
  // The main `query.data` will contain the streaming message directly.
  return {
    ...query,
    streamingMessage: null, // This is now handled within the main messages list
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
      // Invalidate messages to refresh the list after ending training
      queryClient.invalidateQueries({
        queryKey: trainingMessageKeys.list(chatId),
      });
    },
    onError: (error) => {
      logError("Error ending training:", error);
    },
  });
}

// Hook for submitting assessments
export function useSubmitAssessment() {
  const { emitSubmitAssessment } = useWebSocket();

  return useMutation({
    mutationFn: async ({
      chatId,
      responses,
    }: {
      chatId: string;
      responses: Record<string, unknown>;
    }) => {
      emitSubmitAssessment({ chat_id: chatId, responses });
      return { success: true };
    },
    onError: (error) => {
      logError("Error submitting assessment:", error);
    },
  });
}

// Hook for generating feedback
export function useGenerateFeedback() {
  const { emitGenerateFeedback } = useWebSocket();

  return useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      emitGenerateFeedback({ chat_id: chatId });
      return { success: true };
    },
    onError: (error) => {
      logError("Error generating feedback:", error);
    },
  });
}

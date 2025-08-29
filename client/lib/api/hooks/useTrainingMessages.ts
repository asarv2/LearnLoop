// lib/api/hooks/useTrainingMessages.ts
import { useWebSocket } from "@/contexts/websocket-context";
import { Message } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../fetcher";

export const trainingMessageKeys = {
  list: (chatId: string) => ["training-messages", chatId] as const,
};

export function useTrainingMessages(chatId: string, enabled = true) {
  const queryClient = useQueryClient();
  const { isConnected, joinRoom, leaveRoom } = useWebSocket();
  const joinedRef = useRef(false);

  const query = useQuery({
    queryKey: trainingMessageKeys.list(chatId),
    queryFn: () => api<Message[]>(`/api/v1/messages?chat_id=${chatId}`),
    enabled: enabled && !!chatId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!chatId || !isConnected) return;
    if (!joinedRef.current) {
      logInfo(`Joining training room: ${chatId}`);
      joinRoom(chatId);
      joinedRef.current = true;
    }
    return () => {
      if (joinedRef.current) {
        logInfo(`Leaving training room: ${chatId}`);
        leaveRoom(chatId);
        joinedRef.current = false;
      }
    };
  }, [chatId, isConnected, joinRoom, leaveRoom]);

  useEffect(() => {
    const qk = trainingMessageKeys.list(chatId);

    const onUserSaved = (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;
      const real: Message = e.detail.message;

      queryClient.setQueryData<Message[]>(qk, (old = []) => {
        // append if not present
        if (old.some((m) => m.id === real.id)) return old;
        return [...old, real];
      });
    };

    const onStart = (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;
      logInfo("AI message started", e.detail);

      queryClient.setQueryData<Message[]>(qk, (old = []) => {
        // prevent duplicates
        if (old.some((m) => m.id === e.detail.messageId)) return old;
        const newAssistant: Message = {
          id: e.detail.messageId,
          persona_id: e.detail.personaId ?? null,
          role: "assistant",
          content: "",
          completed: false,
          created_at: new Date().toISOString(),
          chat_id: chatId,
          completed_at: "",
          error: null,
          training_id: null,
        };
        return [...old, newAssistant];
      });
    };

    const onToken = (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.map((m) =>
          m.id === e.detail.messageId
            ? { ...m, content: e.detail.accumulatedContent }
            : m
        )
      );
    };

    const onComplete = (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.map((m) =>
          m.id === e.detail.messageId
            ? { ...m, content: e.detail.finalContent, completed: true }
            : m
        )
      );
    };

    const onError = (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;
      logError("Streaming error", e.detail.error);
      // remove the incomplete assistant placeholder (if it exists)
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.filter((m) => m.id !== e.detail.messageId)
      );
    };

    // Register DOM CustomEvent listeners that your websocket context dispatches
    window.addEventListener("userMessageSaved", onUserSaved as EventListener);
    window.addEventListener("trainingMessageStart", onStart as EventListener);
    window.addEventListener("trainingMessageToken", onToken as EventListener);
    window.addEventListener(
      "trainingMessageComplete",
      onComplete as EventListener
    );
    window.addEventListener("trainingMessageError", onError as EventListener);

    return () => {
      window.removeEventListener(
        "userMessageSaved",
        onUserSaved as EventListener
      );
      window.removeEventListener(
        "trainingMessageStart",
        onStart as EventListener
      );
      window.removeEventListener(
        "trainingMessageToken",
        onToken as EventListener
      );
      window.removeEventListener(
        "trainingMessageComplete",
        onComplete as EventListener
      );
      window.removeEventListener(
        "trainingMessageError",
        onError as EventListener
      );
    };
  }, [chatId, queryClient]);

  return { ...query, isConnected };
}

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
      // no optimistic cache writes—server will emit the saved user message
      emitSendTrainingMessage({ chat_id: chatId, message });
      return { success: true };
    },
    onError: (error) => logError("Error sending training message:", error),
  });
}

export function useEndTraining() {
  const { emitEndTraining } = useWebSocket();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId }: { chatId: string }) => {
      emitEndTraining({ chat_id: chatId });
      return { success: true };
    },
    onSuccess: (_, { chatId }) => {
      // optional: force refresh, though socket events should keep you updated
      queryClient.invalidateQueries({
        queryKey: trainingMessageKeys.list(chatId),
      });
    },
    onError: (error) => logError("Error ending training:", error),
  });
}

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
    onError: (error) => logError("Error submitting assessment:", error),
  });
}

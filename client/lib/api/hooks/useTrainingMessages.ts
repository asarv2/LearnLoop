// lib/api/hooks/useTrainingMessages.ts
import { useWebSocket } from "@/contexts/websocket-context";
import { Message } from "@/types";
import { logError, logInfo } from "@/utils/logger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { api } from "../fetcher";

export const trainingMessageKeys = {
  list: (chatId: string) => ["training-messages", chatId] as const,
};

export function useTrainingMessages(chatId: string, enabled = true) {
  const queryClient = useQueryClient();
  const { isConnected, joinRoom, leaveRoom } = useWebSocket();
  const joinedRef = useRef(false);

  // Deduplication guards
  const startedIdsRef = useRef(new Set<string>());

  // Throttling for token updates
  const bufferRef = useRef<Record<string, string>>({});
  const rafRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: trainingMessageKeys.list(chatId),
    queryFn: () => api<Message[]>(`/api/v1/messages?chat_id=${chatId}`),
    enabled: enabled && !!chatId,
    staleTime: 30_000,
  });

  // Throttled flush function for token updates
  const flush = useCallback(() => {
    rafRef.current = null;
    const buffer = bufferRef.current;
    bufferRef.current = {};

    const qk = trainingMessageKeys.list(chatId);
    queryClient.setQueryData<Message[]>(qk, (old = []) =>
      old.map((m) =>
        buffer[m.id] !== undefined ? { ...m, content: buffer[m.id]! } : m
      )
    );
  }, [chatId, queryClient]);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(flush);
  }, [flush]);

  // Stable callback references
  const onUserSaved = useCallback(
    (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;
      const real: Message = e.detail.message;

      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) => {
        // append if not present
        if (old.some((m) => m.id === real.id)) return old;
        return [...old, real];
      });
    },
    [chatId, queryClient]
  );

  const onStart = useCallback(
    (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;

      // Deduplication guard
      if (startedIdsRef.current.has(e.detail.messageId)) return;
      startedIdsRef.current.add(e.detail.messageId);

      logInfo("AI message started", e.detail);

      const qk = trainingMessageKeys.list(chatId);
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
    },
    [chatId, queryClient]
  );

  const onToken = useCallback(
    (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;

      // Buffer token updates and schedule flush
      bufferRef.current[e.detail.messageId] = e.detail.accumulatedContent;
      scheduleFlush();
    },
    [chatId, scheduleFlush]
  );

  const onComplete = useCallback(
    (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;

      // Clear from buffer and update immediately
      delete bufferRef.current[e.detail.messageId];
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.map((m) =>
          m.id === e.detail.messageId
            ? { ...m, content: e.detail.finalContent, completed: true }
            : m
        )
      );
    },
    [chatId, queryClient]
  );

  const onError = useCallback(
    (e: CustomEvent) => {
      if (e.detail.chatId !== chatId) return;
      logError("Streaming error", e.detail.error);

      // Clear from buffer and remove the incomplete assistant placeholder
      delete bufferRef.current[e.detail.messageId];
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.filter((m) => m.id !== e.detail.messageId)
      );
    },
    [chatId, queryClient]
  );

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
      // Clean up RAF if component unmounts
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

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
  }, [onUserSaved, onStart, onToken, onComplete, onError]); // Stable dependencies

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

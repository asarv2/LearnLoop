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

// Event detail types that handle both camelCase and snake_case
type EventDetail = {
  chatId?: string;
  chat_id?: string;
  messageId?: string;
  message_id?: string;
  personaId?: string;
  persona_id?: string;
  accumulatedContent?: string;
  accumulated_content?: string;
  finalContent?: string;
  final_content?: string;
  delta?: string;
  token?: string;
  error?: string;
  message?: Message;
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
      old.map((m) => {
        const pending = buffer[m.id];
        if (pending === undefined) return m;
        // ✅ append streamed piece(s) to what's already rendered
        return { ...m, content: (m.content ?? "") + pending };
      })
    );
  }, [chatId, queryClient]);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    // requestAnimationFrame is throttled when tab is hidden; fall back to setTimeout
    const visible =
      typeof document !== "undefined"
        ? document.visibilityState === "visible"
        : true;
    if (visible) {
      rafRef.current = requestAnimationFrame(flush);
    } else {
      // use -1 as a sentinel "scheduled" value
      rafRef.current = -1 as unknown as number;
      setTimeout(() => {
        flush();
        rafRef.current = null;
      }, 50);
    }
  }, [flush]);

  // Stable callback references
  const onUserSaved = useCallback(
    (e: CustomEvent) => {
      const d = (e.detail || {}) as EventDetail;
      const cid = d.chatId ?? d.chat_id;
      if (cid !== chatId) return;
      const real: Message = d.message!;

      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) => {
        const i = old.findIndex((m) => m.id === real.id);
        if (i === -1) return [...old, real]; // not present → append
        // present → merge newest server fields (esp. content/completed)
        const next = old.slice();
        next[i] = {
          ...old[i],
          ...real,
          content: real.content ?? old[i].content ?? "",
          completed: real.completed ?? old[i].completed ?? false,
          persona_id: real.persona_id ?? old[i].persona_id ?? null,
        };
        return next;
      });
    },
    [chatId, queryClient]
  );

  const onStart = useCallback(
    (e: CustomEvent) => {
      const d = (e.detail || {}) as EventDetail;
      const cid = d.chatId ?? d.chat_id;
      if (cid !== chatId) return;

      // Deduplication guard
      const mid = d.messageId ?? d.message_id;
      if (!mid || startedIdsRef.current.has(mid)) return;
      startedIdsRef.current.add(mid);

      logInfo("AI message started", d);

      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) => {
        // prevent duplicates
        if (old.some((m) => m.id === mid)) return old;
        const newAssistant: Message = {
          id: mid,
          persona_id: d.personaId ?? d.persona_id ?? null,
          role: "assistant",
          content: "",
          completed: false,
          created_at: new Date().toISOString(),
          chat_id: chatId,
          completed_at: "",
          error: null,
          training_id: null,
          word_timestamps: [],
        };
        return [...old, newAssistant];
      });
    },
    [chatId, queryClient]
  );

  const onToken = useCallback(
    (e: CustomEvent) => {
      const d = (e.detail || {}) as EventDetail;
      const cid = d.chatId ?? d.chat_id;
      if (cid !== chatId) return;
      const mid = d.messageId ?? d.message_id;
      if (!mid) return;

      // ✅ Stream by token: append the new token to this frame's buffer
      const delta = d.token ?? d.delta ?? "";
      if (delta) {
        bufferRef.current[mid] = (bufferRef.current[mid] ?? "") + String(delta);
      } else {
        // (optional) fallback if your server sometimes sends accumulated_content
        const acc = d.accumulatedContent ?? d.accumulated_content;
        if (!acc) return;
        // If you do receive accumulated_content, you can either:
        //  A) replace buffer with acc, AND in flush still append to m.content (works fine)
        //  B) ignore it (prefer token streaming)
        bufferRef.current[mid] = acc;
      }
      scheduleFlush();
    },
    [chatId, scheduleFlush]
  );

  const onUserToken = useCallback(
    (e: CustomEvent) => {
      const d = (e.detail || {}) as EventDetail;
      const cid = d.chatId ?? d.chat_id;
      if (cid !== chatId) return;
      const mid = d.messageId ?? d.message_id;
      if (!mid) return;

      // ensure the message exists in cache (rare race)
      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) => {
        if (old.some((m) => m.id === mid)) return old;
        return [
          ...old,
          {
            id: mid,
            chat_id: chatId,
            role: "user",
            content: "",
            completed: false,
            created_at: new Date().toISOString(),
            completed_at: "",
            error: null,
            persona_id: null,
            training_id: null,
            word_timestamps: [],
          },
        ];
      });

      const delta = d.token ?? d.delta ?? "";
      if (delta) {
        bufferRef.current[mid] = (bufferRef.current[mid] ?? "") + String(delta);
      } else {
        const acc = d.accumulatedContent ?? d.accumulated_content;
        if (!acc) return;
        bufferRef.current[mid] = acc;
      }
      scheduleFlush();
    },
    [chatId, scheduleFlush, queryClient]
  );

  const onComplete = useCallback(
    (e: CustomEvent) => {
      const d = (e.detail || {}) as EventDetail;
      const cid = d.chatId ?? d.chat_id;
      if (cid !== chatId) return;

      // Clear from buffer and update immediately
      const mid = d.messageId ?? d.message_id;
      if (!mid) return;
      delete bufferRef.current[mid];
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.map((m) =>
          m.id === mid
            ? {
                ...m,
                // ✅ snap to final authoritative text on completion
                content: (d.finalContent ?? d.final_content) || m.content || "",
                completed: true,
              }
            : m
        )
      );
    },
    [chatId, queryClient]
  );

  const onUserComplete = useCallback(
    (e: CustomEvent) => {
      const d = (e.detail || {}) as EventDetail;
      const cid = d.chatId ?? d.chat_id;
      if (cid !== chatId) return;
      const mid = d.messageId ?? d.message_id;
      if (!mid) return;
      delete bufferRef.current[mid];
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.map((m) =>
          m.id === mid
            ? {
                ...m,
                content: (d.finalContent ?? d.final_content) || m.content || "",
                completed: true,
              }
            : m
        )
      );
    },
    [chatId, queryClient]
  );

  const onError = useCallback(
    (e: CustomEvent) => {
      const d = (e.detail || {}) as EventDetail;
      const cid = d.chatId ?? d.chat_id;
      if (cid !== chatId) return;
      logError("Streaming error", d.error);

      // Clear from buffer and remove the incomplete assistant placeholder
      const mid = d.messageId ?? d.message_id;
      if (!mid) return;
      delete bufferRef.current[mid];
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const qk = trainingMessageKeys.list(chatId);
      queryClient.setQueryData<Message[]>(qk, (old = []) =>
        old.filter((m) => m.id !== mid)
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
    window.addEventListener("userMessageToken", onUserToken as EventListener);
    window.addEventListener(
      "trainingMessageComplete",
      onComplete as EventListener
    );
    window.addEventListener(
      "userMessageComplete",
      onUserComplete as EventListener
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
        "userMessageToken",
        onUserToken as EventListener
      );
      window.removeEventListener(
        "trainingMessageComplete",
        onComplete as EventListener
      );
      window.removeEventListener(
        "userMessageComplete",
        onUserComplete as EventListener
      );
      window.removeEventListener(
        "trainingMessageError",
        onError as EventListener
      );
    };
  }, [
    onUserSaved,
    onStart,
    onToken,
    onUserToken,
    onComplete,
    onUserComplete,
    onError,
  ]); // Stable dependencies

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

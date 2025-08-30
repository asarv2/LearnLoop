// lib/api/hooks/useHints.ts
import type { HintCreate, HintUpdate } from "@/lib/repos/hintRepo";
import type { MessageCreate, MessageHint } from "@/lib/repos/messageRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../fetcher";
import { hintKeys } from "../keys";
import { useMessageHints, useMessagesByChat } from "./useMessages";

type MinimalMessage = Pick<
  MessageCreate,
  "id" | "chat_id" | "role" | "completed" | "created_at"
>;

function pickLatestAssistantMessageId(
  msgs: MinimalMessage[] | undefined,
  chatId: string | undefined
): string | null {
  if (!msgs || !chatId) return null;
  const latest = msgs
    .filter(
      (m) =>
        m.chat_id === chatId &&
        m.role === "assistant" &&
        m.completed === true &&
        m.created_at // ensure created_at exists
    )
    .sort((a, b) => +new Date(b.created_at!) - +new Date(a.created_at!))
    .at(0);
  return latest?.id ?? null;
}

/**
 * useLatestMessageHints
 *
 * Use this to always show the hints for the latest completed assistant message
 * in a given chat. Works even after refresh:
 * - If you pass `seedMessages` (e.g., ChatArea's displayMessages), we use them.
 * - Else we fall back to useMessages() and compute on the client.
 * - Then we call your existing /api/v1/messages/:id/hints endpoint via useMessageHints().
 *
 * Returns:
 * - messageId: the resolved latest assistant message id (or null)
 * - hints: MessageHint[] | undefined
 * - isLoading: combined loading state (messages + hints)
 */
export function useLatestMessageHints(
  chatId: string | undefined,
  seedMessages?: MinimalMessage[],
  enabled: boolean = true
) {
  const qc = useQueryClient();

  // 1) Try to resolve the latest assistant message id from seed messages first (fast path)
  const seedLatestId = useMemo(
    () => pickLatestAssistantMessageId(seedMessages, chatId),
    [seedMessages, chatId]
  );

  // 2) If we didn't get it from seed, fall back to the chat-specific messages list
  const { data: allMessages, isLoading: isLoadingMessages } = useMessagesByChat(
    chatId,
    enabled && !seedLatestId
  );

  const latestMessageId = useMemo(() => {
    if (seedLatestId) return seedLatestId;
    return pickLatestAssistantMessageId(allMessages, chatId);
  }, [seedLatestId, allMessages, chatId]);

  // 3) Fetch hints for that message id using the existing endpoint
  const {
    data: hints,
    isLoading: isLoadingHints,
    refetch,
  } = useMessageHints(latestMessageId ?? "", enabled && !!latestMessageId);

  // (Optional) Try an instant hydration from cache if you keep hints cached by message
  // This avoids a flicker when data is already in the client cache.
  const cachedHints = qc.getQueryData<MessageHint[]>(
    latestMessageId ? [["messages", "detail", latestMessageId], "hints"] : []
  );
  const effectiveHints = cachedHints ?? hints;

  return {
    messageId: latestMessageId ?? null,
    hints: effectiveHints,
    isLoading:
      (enabled && !!chatId && !seedLatestId && isLoadingMessages) ||
      isLoadingHints,
    refetch,
  };
}

// ---------- Original Queries ----------
export function useHints() {
  return useQuery({
    queryKey: hintKeys.list(),
    queryFn: () => api<HintCreate[]>("/api/v1/hints"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useHint(id: string, enabled = true) {
  return useQuery({
    queryKey: hintKeys.detail(id),
    queryFn: () => api<HintCreate>(`/api/v1/hints/${id}`),
    enabled,
  });
}

// ---------- Original Mutations ----------
export function useCreateHint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: HintCreate) =>
      api<HintCreate>("/api/v1/hints", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: hintKeys.all });
    },
  });
}

export function useUpdateHint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: HintUpdate) =>
      api<HintCreate>(`/api/v1/hints/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: hintKeys.detail(id) });
    },
  });
}

export function useDeleteHint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/hints/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: hintKeys.all });
    },
  });
}

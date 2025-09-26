// hooks/useCutWindow.ts
import type { Message } from "@/types";
import { useCallback, useEffect, useState } from "react";

type Cut = {
  // If set: include anchor assistant itself, hide everything after it
  afterAssistantId: string | null;
  // If set: hide this user message and everything after it
  beforeUserId: string | null;
};

export function useCutWindow(chatId?: string) {
  const key = chatId ? `cut:${chatId}` : null;
  const [cut, setCut] = useState<Cut>({
    afterAssistantId: null,
    beforeUserId: null,
  });

  // Rehydrate once
  useEffect(() => {
    if (!key) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw)
        setCut({
          ...{ afterAssistantId: null, beforeUserId: null },
          ...(JSON.parse(raw) as Cut),
        });
    } catch {}
  }, [key]);

  // Persist
  useEffect(() => {
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(cut));
    } catch {}
  }, [key, cut]);

  const startRetry = useCallback(
    (afterAssistantId: string, beforeUserId?: string | null) => {
      setCut({ afterAssistantId, beforeUserId: beforeUserId ?? null });
    },
    []
  );

  const clear = useCallback(
    () => setCut({ afterAssistantId: null, beforeUserId: null }),
    []
  );

  // Project a raw message list into a visible window using the cut rules
  const project = useCallback(
    (messages: Message[]) => {
      if (!messages?.length) return messages;

      // Compute slice indexes for both constraints, apply the earliest
      const idxs: number[] = [];

      if (cut.beforeUserId) {
        const i = messages.findIndex((m) => m.id === cut.beforeUserId);
        if (i >= 0) idxs.push(i); // cut *before* the user message being replaced
      }

      if (cut.afterAssistantId) {
        const j = messages.findIndex((m) => m.id === cut.afterAssistantId);
        if (j >= 0) idxs.push(j + 1); // keep anchor assistant, hide after
      }

      if (idxs.length === 0) return messages;

      const end = Math.min(...idxs);
      return end >= 0 ? messages.slice(0, end) : messages;
    },
    [cut.beforeUserId, cut.afterAssistantId]
  );

  const isActive = Boolean(cut.afterAssistantId || cut.beforeUserId);

  return { cut, isActive, startRetry, clear, project };
}

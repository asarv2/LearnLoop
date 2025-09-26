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

      const { afterAssistantId: root, beforeUserId: oldUser } = cut;
      if (!root && !oldUser) return messages;

      // index lookup for quick boundaries
      const indexById = new Map<string, number>();
      const msgById = new Map<
        string,
        Message & { parent_id?: string | null }
      >();
      messages.forEach((m, i) => {
        indexById.set(m.id, i);
        msgById.set(m.id, m as Message & { parent_id?: string | null });
      });

      const rootIdx = root ? indexById.get(root) ?? -1 : -1;
      const oldIdx = oldUser
        ? indexById.get(oldUser) ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;

      // Everything before the earliest boundary stays
      // (keep the anchor itself when present)
      const baseEnd = Math.min(
        oldIdx,
        rootIdx >= 0 ? rootIdx + 1 : Number.POSITIVE_INFINITY
      );
      const head =
        baseEnd === Number.POSITIVE_INFINITY
          ? messages.slice()
          : messages.slice(0, baseEnd);

      // If no anchor, we're done (we cut before old user only)
      if (!root || rootIdx < 0) return head;

      // Helper: does a message's ancestry include a given id?
      const hits = (startId: string | null | undefined, targetId: string) => {
        let cur = startId;
        let hop = 0;
        while (cur && hop++ < 2048) {
          if (cur === targetId) return true;
          const p = msgById.get(cur)?.parent_id ?? null;
          cur = typeof p === "string" ? p : null;
        }
        return false;
      };

      // Tail: allow any new msgs on the root branch,
      // but exclude anything under the old user subtree
      const tail = messages.slice(baseEnd).filter((m) => {
        const pid = (m as Message & { parent_id?: string | null }).parent_id;
        const onRootBranch = hits(pid, root);
        const underOldUser = oldUser ? hits(m.id, oldUser) : false;
        return onRootBranch && !underOldUser;
      });

      return [...head, ...tail];
    },
    [cut]
  );

  const isActive = Boolean(cut.afterAssistantId || cut.beforeUserId);

  return { cut, isActive, startRetry, clear, project };
}

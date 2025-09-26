// hooks/useThread.ts
import type { Message } from "@/types";
import { useMemo } from "react";

export type RetryState = {
  anchorAssistantId: string | null; // assistant message to retry from
  userMessageId?: string | null; // user message being replaced
  isActive: boolean; // convenience flag (anchorAssistantId != null)
};

export function useThread({
  messages,
  currentAssistantId,
  lastAssistantId,
  retry, // { anchorAssistantId }
}: {
  messages: Message[];
  currentAssistantId: string | null;
  lastAssistantId: string | null;
  retry: RetryState;
}) {
  /**
   * Source of truth for the "tip":
   * - If retry.active -> tip = retry.anchorAssistantId (we hide past it)
   * - Else streaming assistant -> tip = currentAssistantId
   * - Else last completed assistant -> tip = lastAssistantId
   * - Else last message in messages
   */
  const {
    visibleThread,
    tipId,
    anchorId,
    bannerAfterId, // ← id of the message after which to insert banner
    bannerAtTop, // ← true if banner should be rendered at very top
    anchorPresent, // ← whether anchorAssistantId exists in `messages`
  } = useMemo(() => {
    const byId = new Map<string, Message>();
    for (const m of messages) if (m?.id) byId.set(m.id, m);

    const anchorPresent = !!(
      retry.anchorAssistantId && byId.has(retry.anchorAssistantId)
    );

    // ---- Optimistic clamp while anchor hasn't arrived yet ----
    if (retry.anchorAssistantId && !anchorPresent) {
      // If we know which user message is being replaced, cut before it.
      if (retry.userMessageId) {
        const idx = messages.findIndex((m) => m.id === retry.userMessageId);

        if (idx >= 0) {
          const prefix = messages.slice(0, idx); // strictly before the replaced user msg
          const bannerAfterId = idx > 0 ? messages[idx - 1].id : null;
          const bannerAtTop = idx === 0;

          return {
            visibleThread: prefix,
            tipId: retry.anchorAssistantId,
            anchorId: retry.anchorAssistantId,
            bannerAfterId,
            bannerAtTop,
            anchorPresent: false,
          };
        }
      }

      // Fallback: cut after the last assistant we can see (conservative)
      const lastSeenAssistantId = [...messages]
        .reverse()
        .find((m) => m.role === "assistant")?.id;
      const cutIdx = lastSeenAssistantId
        ? messages.findIndex((m) => m.id === lastSeenAssistantId) + 1
        : 0;

      const prefix = messages.slice(0, cutIdx);
      const bannerAfterId = cutIdx > 0 ? messages[cutIdx - 1].id : null;
      const bannerAtTop = cutIdx === 0;

      return {
        visibleThread: prefix,
        tipId: retry.anchorAssistantId,
        anchorId: retry.anchorAssistantId,
        bannerAfterId,
        bannerAtTop,
        anchorPresent: false,
      };
    }
    // ---- END optimistic clamp ----

    // Choose the tip normally
    let tipCandidate: string | undefined;
    if (retry.anchorAssistantId) {
      tipCandidate = retry.anchorAssistantId;
    } else if (currentAssistantId && byId.has(currentAssistantId)) {
      tipCandidate = currentAssistantId;
    } else if (lastAssistantId && byId.has(lastAssistantId)) {
      tipCandidate = lastAssistantId;
    } else if (messages.length > 0) {
      tipCandidate = messages[messages.length - 1].id;
    }

    if (!tipCandidate) {
      return {
        visibleThread: [] as Message[],
        tipId: undefined,
        anchorId: retry.anchorAssistantId,
        bannerAfterId: null,
        bannerAtTop: false,
        anchorPresent,
      };
    }

    // Walk parent chain tip -> root
    const chain: Message[] = [];
    const seen = new Set<string>();
    let cur = byId.get(tipCandidate);
    while (cur && !seen.has(cur.id)) {
      chain.push(cur);
      seen.add(cur.id);
      const pid: string | null | undefined = (
        cur as unknown as { parent_id?: string | null }
      ).parent_id;
      if (!pid) break;
      cur = byId.get(String(pid));
      if (!cur) break; // parent not loaded yet (stream race) -> short chain
    }

    // If chain is trivial AND not retrying, show full list for streaming UX
    if (chain.length < 2 && !retry.anchorAssistantId) {
      // If the tip is a *user* with unknown parent, only show up to that user.
      const tipMsg = byId.get(tipCandidate);
      if (tipMsg?.role === "user") {
        const idx = messages.findIndex((m) => m.id === tipCandidate);
        const prefix = idx >= 0 ? messages.slice(0, idx + 1) : messages;
        return {
          visibleThread: prefix,
          tipId: tipCandidate,
          anchorId: retry.anchorAssistantId,
          bannerAfterId: null,
          bannerAtTop: false,
          anchorPresent,
        };
      }
      // Otherwise keep current behavior
      return {
        visibleThread: messages,
        tipId: tipCandidate,
        anchorId: retry.anchorAssistantId,
        bannerAfterId: null,
        bannerAtTop: false,
        anchorPresent,
      };
    }

    return {
      visibleThread: chain.reverse(),
      tipId: tipCandidate,
      anchorId: retry.anchorAssistantId,
      bannerAfterId: null, // when anchor is present, banner will be shown beside the anchor in UI
      bannerAtTop: false,
      anchorPresent,
    };
  }, [
    messages,
    currentAssistantId,
    lastAssistantId,
    retry.anchorAssistantId,
    retry.userMessageId,
  ]);

  /**
   * Visibility helpers:
   * - When retry is active: only show up to (and including) anchor
   * - Otherwise: show entire computed thread
   */
  const isRetrying = Boolean(anchorId);
  const allowedIds = new Set(visibleThread.map((m) => m.id));

  return {
    isRetrying,
    anchorId,
    tipId,
    anchorPresent,
    bannerAfterId,
    bannerAtTop,
    visibleMessages: visibleThread,
    // Useful if you want to gray-out/hide non-thread items when we fell back to full list
    isVisible: (id: string) => allowedIds.has(id),
  };
}

// hooks/useRetry.ts
import { useCallback, useState } from "react";

export function useRetry() {
  const [anchorAssistantId, setAnchor] = useState<string | null>(null);
  const [userMessageId, setUserMessageId] = useState<string | null>(null);

  // pass both assistant anchor and the user message being replaced
  const toggleRetryFrom = useCallback(
    (assistantId: string | null, userMsgId?: string | null) => {
      setAnchor((prev) => {
        const next = prev === assistantId ? null : assistantId;
        // keep userMessageId in sync
        if (next) setUserMessageId(userMsgId ?? null);
        else setUserMessageId(null);
        return next;
      });
    },
    []
  );

  const clearRetry = useCallback(() => {
    setAnchor(null);
    setUserMessageId(null);
  }, []);

  return {
    anchorAssistantId,
    userMessageId,
    isActive: anchorAssistantId !== null,
    toggleRetryFrom,
    clearRetry,
  };
}

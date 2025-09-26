/**
 * ChatArea.tsx
 * Simplified chat interface with explicit connect and mic controls
 *
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

import Markdown from "@/components/common/Markdown";
import { Chat, Message } from "@/types";
import {
  ChatBubbleIcon,
  PaperPlaneIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Switch,
  Text,
} from "@radix-ui/themes";
// Removed mic icons in favor of a consistent "Voice Mode" label
import React, {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Import necessary hooks
import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { useCutWindow } from "@/hooks/useCutWindow";
import { useLatestMessageHints } from "@/lib/api/hooks/useHints";
import { usePersonas, useUserPersona } from "@/lib/api/hooks/usePersonas";
import { useScenario } from "@/lib/api/hooks/useScenarios";
import { renderMessageContent } from "@/lib/renderMessageContent";

const INTRO_MESSAGES = [
  "Hey, how's your day been?",
  "Hi! How are you doing?",
  "Hey, how's everything going?",
];

// Local retry banner component
function LocalRetryBanner({ onUndo }: { onUndo: () => void }) {
  return (
    <Card
      size="2"
      style={{
        border: "1px solid var(--amber-7)",
        background: "var(--amber-2)",
        borderRadius: "12px",
      }}
    >
      <Flex align="center" justify="between" gap="3">
        <Text size="2" style={{ color: "var(--amber-11)" }}>
          Retrying from here — this user turn and all following messages are
          hidden.
        </Text>
        <Button size="1" variant="outline" onClick={onUndo}>
          Undo
        </Button>
      </Flex>
    </Card>
  );
}

interface ChatAreaProps {
  displayMessages: Message[];
  isSendingMessage: boolean;
  isEndingSession: boolean;
  isSessionActive: boolean;
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chat: Chat;
}

export default function ChatArea({
  displayMessages,
  isSendingMessage,
  isEndingSession,
  isSessionActive,
  currentMessage,
  setCurrentMessage,
  messagesEndRef,
  chat,
}: ChatAreaProps) {
  // WebSocket context
  const {
    isRTCConnected,
    isAudioBridgeReady,
    micOn,
    voiceMode,
    enableVoiceMode,
    connectRTC,
    joinRoom,
    toggleMic,
    sendWebRTCMessage,
    setParentCursor,
    getLocalMicStream,
  } = useWebSocket();

  // Auto-enable voice mode once per chat
  const autoEnableVoiceModeRef = React.useRef<string | null>(null);

  // Scroll tracking refs
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const nearBottomRef = React.useRef(true);
  const forceScrollRef = React.useRef(false);
  const lastMsgIdRef = React.useRef<string | null>(null);
  const prevScrollHeightRef = React.useRef(0);

  // Hints-related state
  const [showHints, setShowHints] = useState(false);
  const [hintsDifficulty, setHintsDifficulty] = useState<"easy" | "hard">(
    "hard"
  );
  const [lastAIResponse, setLastAIResponse] = useState<string>("");
  const [realtimeLowHints, setRealtimeLowHints] = useState<string[] | null>(
    null
  );
  const [realtimeHighHints, setRealtimeHighHints] = useState<string[] | null>(
    null
  );
  const [lastAssistantId, setLastAssistantId] = useState<string | null>(null);
  const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(
    null
  );

  // Cut window for retry state management
  const cutWin = useCutWindow(chat?.id);

  // Project displayMessages through the cut window
  const visibleMessages = React.useMemo(
    () => cutWin.project(displayMessages),
    [displayMessages, cutWin]
  );

  // Build a quick lookup over the visible thread
  const byId = React.useMemo(() => {
    const map = new Map<string, Message & { parent_id?: string | null }>();
    visibleMessages.forEach((m) =>
      map.set(m.id, m as Message & { parent_id?: string | null })
    );
    return map;
  }, [visibleMessages]);

  // Walk ancestry: does "startId" have "targetId" in its parent chain?
  const hits = React.useCallback(
    (startId: string | null | undefined, targetId: string) => {
      let cur = startId;
      let hop = 0; // guard against cycles
      while (cur && hop++ < 2048) {
        if (cur === targetId) return true;
        const p = byId.get(cur)?.parent_id ?? null;
        cur = typeof p === "string" ? p : null;
      }
      return false;
    },
    [byId]
  );

  // Show the banner only until any new tail (replacement branch) appears
  const showRetryBanner = React.useMemo(() => {
    if (!cutWin.isActive || !cutWin.cut.afterAssistantId) return false;
    const root = cutWin.cut.afterAssistantId;
    const old = cutWin.cut.beforeUserId;

    // Any message on the root branch (not the anchor itself),
    // and NOT under the old user subtree => hide banner.
    const hasTail = visibleMessages.some((m) => {
      if (m.id === root) return false; // ignore the anchor itself
      const pid = (m as Message & { parent_id?: string | null }).parent_id;
      const onRoot = hits(pid, root);
      const underOld = old ? hits(m.id, old) : false;
      return onRoot && !underOld;
    });

    return !hasTail;
  }, [
    cutWin.isActive,
    cutWin.cut.afterAssistantId,
    cutWin.cut.beforeUserId,
    visibleMessages,
    hits,
  ]);

  // Optional: tiny banner placement (right after the last visible bubble)
  const bannerAfterId = React.useMemo(() => {
    if (!cutWin.isActive || visibleMessages.length === 0) return null;
    return visibleMessages[visibleMessages.length - 1]?.id ?? null;
  }, [cutWin.isActive, visibleMessages]);

  // Undo retry helper that clears cut and restores server cursor to latest tip
  const undoRetry = useCallback(() => {
    cutWin.clear();
    // Optional: restore server tip to the last assistant we can see
    const restoreTo =
      [...visibleMessages].reverse().find((m) => m.role === "assistant")?.id ??
      lastAssistantId ??
      currentAssistantId ??
      null;
    if (restoreTo) {
      try {
        setParentCursor(chat?.id, restoreTo);
      } catch {}
    }
  }, [
    cutWin,
    visibleMessages,
    lastAssistantId,
    currentAssistantId,
    chat?.id,
    setParentCursor,
  ]);

  // Transcript state per message id
  const [transcripts, setTranscripts] = useState<
    Record<
      string,
      {
        start_ts_ms: number;
        words: { start_ms: number; end_ms: number; text: string }[];
        text: string;
      }
    >
  >({});
  const [transcriptStops, setTranscriptStops] = useState<
    Record<string, number>
  >({});
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Transcript buffering for smooth updates
  const trBufRef = useRef<
    Record<
      string,
      {
        start_ts_ms: number;
        words: { start_ms: number; end_ms: number; text: string }[];
        text: string;
      }
    >
  >({});
  const [trVersion, setTrVersion] = useState(0); // cheap counter for effects
  const flushTimerRef = useRef<number | null>(null);

  const scheduleTranscriptFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = window.setTimeout(() => {
      const batch = trBufRef.current;
      trBufRef.current = {};
      flushTimerRef.current = null;

      // Mark low priority so typing / clicks stay snappy
      startTransition(() => {
        setTranscripts((prev) => ({ ...prev, ...batch }));
        setTrVersion((v) => v + 1);
      });
    }, 80); // 80–120ms feels great
  }, []);

  // Stop buffering for transcript stops
  const stopBufRef = useRef<Record<string, number>>({});
  const stopFlushTimerRef = useRef<number | null>(null);

  const scheduleStopFlush = useCallback(() => {
    if (stopFlushTimerRef.current) return;
    stopFlushTimerRef.current = window.setTimeout(() => {
      const batch = stopBufRef.current;
      stopBufRef.current = {};
      stopFlushTimerRef.current = null;

      startTransition(() => {
        setTranscriptStops((prev) => ({ ...prev, ...batch }));
      });
    }, 80);
  }, []);

  // Check if any transcript is currently active
  const hasLiveTranscript = useMemo(() => {
    for (const id in transcripts) {
      if (!transcriptStops[id]) return true;
    }
    return false;
  }, [transcriptStops, transcripts]); // use the cheap counter

  // Optimized render clock - only when someone is talking, slower tick
  useEffect(() => {
    if (!hasLiveTranscript) return;
    let raf: number | null = null;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 90) {
        // 80-100ms feels great
        setNowMs(Date.now());
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [hasLiveTranscript, chat?.id]);

  // Use stable scroll handler to track "at bottom?"
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      nearBottomRef.current =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Subscribe to transcript events from websocket-context
  useEffect(() => {
    const onAgentTranscript = (evt: Event) => {
      const e = evt as CustomEvent;
      const d = (e.detail || {}) as {
        message_id?: string | null;
        start_ts_ms: number;
        text: string;
        words: { start_ms: number; end_ms: number; text: string }[];
      };
      if (!d.message_id) return;
      trBufRef.current[d.message_id] = {
        start_ts_ms: Number(d.start_ts_ms) || Date.now(),
        words: Array.isArray(d.words) ? d.words : [],
        text: String(d.text || ""),
      };
      scheduleTranscriptFlush();
    };

    const onAgentTranscriptStop = (evt: Event) => {
      const e = evt as CustomEvent;
      const d = (e.detail || {}) as {
        message_id?: string | null;
        stop_ts_ms: number;
      };
      if (!d.message_id) return;
      stopBufRef.current[d.message_id] = Number(d.stop_ts_ms) || Date.now();
      scheduleStopFlush();
      // Defer client stop dispatch until UI-visible boundary is settled
      try {
        const mid = String(d.message_id);
        setPendingClientStops((prev) => ({ ...prev, [mid]: true }));
      } catch {}
    };

    window.addEventListener(
      "agentTranscript",
      onAgentTranscript as EventListener
    );
    window.addEventListener(
      "agentTranscriptStop",
      onAgentTranscriptStop as EventListener
    );
    return () => {
      window.removeEventListener(
        "agentTranscript",
        onAgentTranscript as EventListener
      );
      window.removeEventListener(
        "agentTranscriptStop",
        onAgentTranscriptStop as EventListener
      );
    };
  }, [scheduleTranscriptFlush, scheduleStopFlush]);

  // Track message ids awaiting client-side interruption boundary dispatch
  const [pendingClientStops, setPendingClientStops] = useState<
    Record<string, boolean>
  >({});

  // When we have a pending stop, compute the boundary based on what the UI would actually show
  // Visibility logic mirrors the render path: include words with start_ms <= elapsed (clamped by stop)
  useEffect(() => {
    if (!chat?.id) return;
    const entries = Object.keys(pendingClientStops).filter(
      (k) => pendingClientStops[k]
    );
    if (entries.length === 0) return;

    const nextPending = { ...pendingClientStops };

    for (const mid of entries) {
      const tr = transcripts[mid];
      if (!tr || !Array.isArray(tr.words) || tr.words.length === 0) {
        continue;
      }

      const start = Number(tr.start_ts_ms) || 0;
      const stopAbs = transcriptStops[mid];
      let elapsed = Math.max(0, nowMs - start);
      if (Number.isFinite(stopAbs)) {
        elapsed = Math.min(elapsed, Number(stopAbs) - start);
      }

      // Determine the last word currently visible by start boundary
      const visibleByStart = tr.words.filter((w) => w.start_ms <= elapsed);
      if (visibleByStart.length === 0) {
        // Not yet visible on UI; try again next tick
        continue;
      }

      // Use the last visible word's end_ms so it matches what the client shows
      const lastVisible = visibleByStart[visibleByStart.length - 1];
      const corrected = Number(lastVisible?.end_ms) || 0;

      window.dispatchEvent(
        new CustomEvent("clientTranscriptStop", {
          detail: {
            chat_id: chat.id,
            message_id: mid,
            stop_ts_ms: corrected,
          },
        })
      );

      delete nextPending[mid];
    }

    if (
      Object.keys(nextPending).length !== Object.keys(pendingClientStops).length
    ) {
      setPendingClientStops(nextPending);
    }
  }, [pendingClientStops, transcripts, transcriptStops, nowMs, chat?.id]);

  // Use the composite hook to get hints for the latest assistant message
  const { hints, isLoading: isLoadingHints } = useLatestMessageHints(
    chat?.id,
    visibleMessages, // seed from props for instant pick
    true // enabled
  );

  // Get the current user and their associated persona
  const { user } = useAuth();
  const { data: userPersona } = useUserPersona(user?.id);
  const { data: allPersonas } = usePersonas();

  // Scenario association - use chat.scenario_id directly
  const scenarioId: string | undefined = chat?.scenario_id || undefined;

  // Fetch scenario data to get document_ids
  const { data: scenarioData } = useScenario(
    scenarioId || "",
    Boolean(scenarioId)
  );

  // Document viewer state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );

  // Get document_ids from scenario data
  const documentIds = useMemo(
    () => scenarioData?.document_ids || [],
    [scenarioData?.document_ids]
  );

  // Set the first document as selected by default when documents are available
  useEffect(() => {
    if (documentIds.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(documentIds[0]);
    }
  }, [documentIds, selectedDocumentId]);

  // Create a memoized map for efficient persona lookup
  const personaMap = React.useMemo(() => {
    if (!allPersonas) return new Map<string, string>();
    return new Map(allPersonas.map((p) => [p.id, p.name]));
  }, [allPersonas]);

  // Handle hints button click
  const handleHintsClick = useCallback(() => {
    setShowHints((s) => !s);
  }, []);

  // Track AI responses for hints generation
  useEffect(() => {
    const lastMessage = visibleMessages[visibleMessages.length - 1];
    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.completed &&
      lastMessage.content
    ) {
      const newResponse = lastMessage.content;
      if (newResponse !== lastAIResponse) {
        setLastAIResponse(newResponse);
      }
    }
  }, [visibleMessages, lastAIResponse]);

  // Request hints when the assistant signals it's DONE
  useEffect(() => {
    const onStart = (e: CustomEvent) => {
      try {
        const d = e.detail || {};
        const chatId = d.chatId ?? d.chat_id;
        const messageId = d.messageId ?? d.message_id;
        if (!chat?.id || chatId !== chat.id || !messageId) return;
        setCurrentAssistantId(String(messageId));
      } catch {}
    };

    const onComplete = (e: CustomEvent) => {
      const d = e.detail || {};
      const chatId = d.chatId ?? d.chat_id;
      const messageId = d.messageId ?? d.message_id;
      const finalContent = d.finalContent ?? d.final_content;
      if (!chat?.id || chatId !== chat.id || !messageId) return;
      // Update local state for UI - hints will be fetched automatically by the hook
      setLastAIResponse(finalContent || "");
      setLastAssistantId(messageId);
      setCurrentAssistantId(null);
      setRealtimeLowHints(null); // Clear any previous real-time hints
      setRealtimeHighHints(null); // Clear any previous real-time hints

      // Clear the cut window when the new assistant finishes
      cutWin.clear();
    };

    window.addEventListener(
      "trainingMessageStart",
      onStart as unknown as EventListener
    );
    window.addEventListener(
      "trainingMessageComplete",
      onComplete as EventListener
    );
    return () => {
      window.removeEventListener(
        "trainingMessageStart",
        onStart as unknown as EventListener
      );
      window.removeEventListener(
        "trainingMessageComplete",
        onComplete as EventListener
      );
    };
  }, [chat?.id, cutWin]);

  // Optional safety: clear clamp on explicit failure
  useEffect(() => {
    const onErr = () => {
      if (cutWin.isActive) cutWin.clear();
    };
    window.addEventListener("trainingMessageError", onErr as EventListener);
    window.addEventListener("trainingStopped", onErr as EventListener);
    return () => {
      window.removeEventListener(
        "trainingMessageError",
        onErr as EventListener
      );
      window.removeEventListener("trainingStopped", onErr as EventListener);
    };
  }, [cutWin]);

  // Listen for hints generated events to show them immediately
  useEffect(() => {
    const handleHintsGenerated = (event: CustomEvent) => {
      const { lowHints, highHints, messageId } = event.detail || {};
      if (!messageId || messageId !== lastAssistantId) return; // only accept newest

      // Store both low and high hints separately
      if (lowHints && Array.isArray(lowHints)) {
        setRealtimeLowHints(lowHints);
      }
      if (highHints && Array.isArray(highHints)) {
        setRealtimeHighHints(highHints);
      }
    };

    window.addEventListener(
      "hintsGenerated",
      handleHintsGenerated as EventListener
    );

    return () => {
      window.removeEventListener(
        "hintsGenerated",
        handleHintsGenerated as EventListener
      );
    };
  }, [lastAssistantId]);

  // Voice Mode toggle handler
  const onToggleVoiceMode = useCallback(() => {
    if (!chat?.id) return;
    // If voice mode is off OR RTC is not connected, (re)enable voice mode.
    if (!voiceMode || !isRTCConnected) {
      enableVoiceMode(chat.id);
    }
  }, [chat?.id, voiceMode, isRTCConnected, enableVoiceMode]);

  // Automatically join room and enable voice mode when chat becomes available (id changes)
  useEffect(() => {
    if (!chat?.id) return;
    if (autoEnableVoiceModeRef.current === chat.id) return;
    autoEnableVoiceModeRef.current = chat.id;
    // Ensure we're in the server room before any messages arrive
    joinRoom(chat.id);
    if (!voiceMode) {
      enableVoiceMode(chat.id);
    } else {
      // Voice already on; ensure RTC is bound to the current room
      void connectRTC(chat.id);
    }
  }, [chat?.id, voiceMode, enableVoiceMode, connectRTC, joinRoom]);

  // Toggle mic handler
  const onToggleMic = useCallback(() => {
    if (!isRTCConnected) return;
    toggleMic();
  }, [isRTCConnected, toggleMic]);

  // ────────────────────────────────────────────────────────────────────────────
  // Waveform visualization (when mic is ON)
  // ────────────────────────────────────────────────────────────────────────────
  const waveformCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = React.useRef<number | null>(null);

  // Time-based audio buffer for 60-second visualization
  const audioBufferRef = React.useRef<number[]>([]);
  const bufferSize = 60; // 60 seconds of audio data
  const updateInterval = 100; // Update every 100ms for smooth animation

  const cleanupWaveform = useCallback(async () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {}
    sourceRef.current = null;
    try {
      analyserRef.current?.disconnect();
    } catch {}
    analyserRef.current = null;
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close();
      }
    } catch {}
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    if (!micOn) {
      cleanupWaveform();
      // Clear the audio buffer when mic is turned off
      audioBufferRef.current = [];
      return;
    }

    const stream = getLocalMicStream();
    if (!stream) return;

    // Initialize audio buffer with blank frames when mic is turned on
    audioBufferRef.current = new Array(bufferSize).fill(0);

    let AudioCtx: typeof AudioContext;
    if (typeof window !== "undefined" && "AudioContext" in window) {
      AudioCtx = (
        window as unknown as {
          AudioContext: typeof AudioContext;
        }
      ).AudioContext;
    } else {
      AudioCtx = (
        window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }
      ).webkitAudioContext;
    }
    const audioCtx = new AudioCtx();
    audioContextRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.7;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const canvas = waveformCanvasRef.current;
    const canvasCtx = canvas?.getContext("2d");
    if (!canvas || !canvasCtx) return;

    const freqArray = new Uint8Array(analyser.frequencyBinCount);

    let last = 0;
    const draw = (t: number) => {
      if (!canvas || !canvasCtx || !analyserRef.current) return;
      if (t - last >= updateInterval) {
        last = t;

        const dpr = window.devicePixelRatio || 1;
        const cssWidth = canvas.clientWidth || 1;
        const cssHeight = canvas.clientHeight || 1;
        if (
          canvas.width !== Math.floor(cssWidth * dpr) ||
          canvas.height !== Math.floor(cssHeight * dpr)
        ) {
          canvas.width = Math.floor(cssWidth * dpr);
          canvas.height = Math.floor(cssHeight * dpr);
          canvasCtx.scale(dpr, dpr);
        }

        canvasCtx.clearRect(0, 0, cssWidth, cssHeight);

        // Get current audio data and add to buffer
        analyserRef.current.getByteFrequencyData(freqArray);
        const currentAvg =
          freqArray.reduce((sum, val) => sum + val, 0) / freqArray.length;

        // Add new audio data to the right side of buffer
        audioBufferRef.current.push(currentAvg);

        // Keep only the last 60 seconds worth of data
        if (audioBufferRef.current.length > bufferSize) {
          audioBufferRef.current.shift(); // Remove oldest data from left
        }

        // Draw the time-based waveform
        const numSegments = Math.min(audioBufferRef.current.length, bufferSize);
        const segmentGap = 3;
        const segmentWidth = cssWidth / numSegments - segmentGap;
        const centerY = cssHeight / 2;

        for (let i = 0; i < numSegments; i++) {
          const audioValue = audioBufferRef.current[i];
          const amplitude = (audioValue / 255) * (cssHeight * 0.4);

          // Position segments from right (newest) to left (oldest)
          const x = cssWidth - (numSegments - i) * (segmentWidth + segmentGap);

          // Draw top segment (above center)
          if (amplitude > 0) {
            const topY = centerY - amplitude;
            canvasCtx.fillStyle = "var(--blue-9)";
            canvasCtx.fillRect(
              x,
              topY,
              Math.max(1, segmentWidth),
              Math.max(1, amplitude)
            );
          }

          // Draw bottom segment (below center) - creates the wave effect
          if (amplitude > 0) {
            const bottomY = centerY;
            canvasCtx.fillStyle = "var(--blue-9)";
            canvasCtx.fillRect(
              x,
              bottomY,
              Math.max(1, segmentWidth),
              Math.max(1, amplitude)
            );
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cleanupWaveform();
    };
  }, [micOn, getLocalMicStream, cleanupWaveform]);

  // Wait for RTC/audio readiness to avoid missing initial audio
  const waitForVoiceReady = useCallback(
    async (timeoutMs = 2000) => {
      const start = Date.now();
      // Fire off voice mode if not already
      if (chat?.id && (!voiceMode || !isRTCConnected)) {
        try {
          await enableVoiceMode(chat.id);
        } catch {}
      }
      // Spin until connected or audio bridge is ready (or timeout)
      while (Date.now() - start < timeoutMs) {
        if (isRTCConnected || isAudioBridgeReady) return;
        await new Promise((r) => setTimeout(r, 50));
      }
    },
    [chat?.id, enableVoiceMode, isRTCConnected, isAudioBridgeReady, voiceMode]
  );

  // Send message handler
  const onSend = useCallback(
    async (messageOverride?: string) => {
      const message = (messageOverride || currentMessage).trim();
      if (!message || !chat?.id) return;

      // Try to unlock audio on first user interaction (fire and forget)
      try {
        const el = document.querySelector("audio") as HTMLAudioElement;
        if (el) {
          el.muted = false;
          el.play().catch(() => {}); // Fire and forget
        }
      } catch (error) {
        console.error("Failed to unlock audio on message send", error);
      }

      // Ensure room join just in case (idempotent, cheap)
      joinRoom(chat.id);
      // Fire and forget voice setup - don't await to avoid delay
      waitForVoiceReady(1500).catch(() => {});
      // Compute parentId: prefer explicit cut anchor -> current assistant -> last assistant -> scan visible messages
      let parentId: string | undefined =
        cutWin.cut.afterAssistantId ||
        currentAssistantId ||
        lastAssistantId ||
        undefined;
      try {
        if (!parentId) {
          for (let i = visibleMessages.length - 1; i >= 0; i--) {
            const m = visibleMessages[i];
            if (m.role === "assistant" && (m.completed || m.content === "")) {
              parentId = m.id;
              break;
            }
          }
        }
      } catch {}
      // Optionally inform server to branch cursor before sending
      try {
        if (parentId) setParentCursor(chat.id, parentId);
      } catch {}
      // Force scroll after user sends a message
      forceScrollRef.current = true;
      // sendWebRTCMessage will still fallback to socket if DC isn't ready
      sendWebRTCMessage(chat.id, message, parentId);
      setCurrentMessage("");
      // Don't clear retry immediately - wait for server confirmation with parent_id
    },
    [
      chat?.id,
      currentMessage,
      joinRoom,
      sendWebRTCMessage,
      setParentCursor,
      setCurrentMessage,
      waitForVoiceReady,
      visibleMessages,
      currentAssistantId,
      lastAssistantId,
      cutWin,
    ]
  );

  // When mic turns ON, seed server parent cursor to latest assistant so
  // the audio transcript user message threads correctly.
  useEffect(() => {
    if (!chat?.id) return;
    if (!micOn) return;
    let parentId: string | undefined =
      cutWin.cut.afterAssistantId ||
      currentAssistantId ||
      lastAssistantId ||
      undefined;
    try {
      if (!parentId) {
        for (let i = visibleMessages.length - 1; i >= 0; i--) {
          const m = visibleMessages[i];
          if (m.role === "assistant" && (m.completed || m.content === "")) {
            parentId = m.id;
            break;
          }
        }
      }
    } catch {}
    try {
      if (parentId) setParentCursor(chat.id, parentId);
    } catch {}
  }, [
    micOn,
    chat?.id,
    visibleMessages,
    currentAssistantId,
    lastAssistantId,
    cutWin.cut.afterAssistantId,
    setParentCursor,
  ]);

  // Clear branch toggle once the server confirms a new user message (works for both RTC and WS paths)
  useEffect(() => {
    const onUserSaved = () => {
      // (no-op) — don't clear retry here, wait for assistant completion
    };
    window.addEventListener("userMessageSaved", onUserSaved as EventListener);
    return () => {
      window.removeEventListener(
        "userMessageSaved",
        onUserSaved as EventListener
      );
    };
  }, [chat?.id, cutWin]);

  // Scroll helper functions (now handled inline for better performance)

  // Pin while content is streaming/growing
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || cutWin.isActive) return;

    const grew = el.scrollHeight > prevScrollHeightRef.current;
    if (grew && nearBottomRef.current) {
      // instant during streaming, smoother for discrete jumps below
      const behavior: ScrollBehavior = hasLiveTranscript ? "auto" : "smooth";
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
    prevScrollHeightRef.current = el.scrollHeight;
  }, [
    trVersion,
    visibleMessages.length,
    transcriptStops,
    cutWin.isActive,
    hasLiveTranscript,
  ]);

  // Smooth only when a *new tail message id* appears
  useEffect(() => {
    const last = visibleMessages[visibleMessages.length - 1];
    const changed = last?.id !== lastMsgIdRef.current;
    if (!changed || cutWin.isActive) return;
    lastMsgIdRef.current = last?.id ?? null;

    if (nearBottomRef.current || forceScrollRef.current) {
      const el = listRef.current;
      if (el)
        el.scrollTo({
          top: el.scrollHeight,
          behavior: hasLiveTranscript ? "auto" : "smooth",
        });
    }
    forceScrollRef.current = false;
  }, [visibleMessages, cutWin.isActive, hasLiveTranscript]);

  // Removed auto-show feedback modal useEffect - modal should only show when user clicks button

  // Early return if chat is not available
  if (!chat) {
    return (
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        <Text size="3" style={{ color: "var(--gray-11)" }}>
          Loading chat...
        </Text>
      </Box>
    );
  }

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.1);
            }
          }
          
          @media (prefers-reduced-motion: reduce) {
            * { 
              animation-duration: 0.001ms !important; 
              animation-iteration-count: 1 !important; 
              transition-duration: 0.001ms !important; 
            }
          }
          
          .md-reset, .md-reset * { font-size: inherit; line-height: inherit; }
          .md-reset p { margin: 0; }
          .md-reset h1,.md-reset h2,.md-reset h3,.md-reset h4,.md-reset h5,.md-reset h6 { 
            font-size: 1em; font-weight: 600; margin: 0; 
          }
          .md-reset ul, .md-reset ol { margin: 0; padding-left: 1.25em; }
        `}
      </style>
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "transparent",
          overflow: "hidden",
          height: "100%",
        }}
        data-scenario-id={scenarioId || undefined}
      >
        {/* Messages */}
        <Box
          ref={listRef}
          style={{
            flex: 1,
            padding: "24px",
            overflow: "auto",
            background: "white",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflowAnchor: "none",
            contain: "layout paint size",
            contentVisibility: "auto",
            containIntrinsicSize: "0 64px",
          }}
        >
          <Flex direction="column" gap="4">
            {/* Show starter prompts when there are no messages and session is active */}
            {visibleMessages.length === 0 && isSessionActive && (
              <Box
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                  padding: "40px 20px",
                }}
              >
                <Box mb="4">
                  <Heading
                    size="4"
                    weight="medium"
                    style={{
                      textAlign: "center",
                      color: "var(--gray-11)",
                      marginBottom: "16px",
                    }}
                  >
                    Select a prompt or type your own
                  </Heading>
                </Box>

                <Flex
                  direction="column"
                  gap="2"
                  style={{ maxWidth: "480px", width: "100%" }}
                >
                  {INTRO_MESSAGES.map((message, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="4"
                      onClick={() => onSend(message)}
                      style={{
                        background: "white",
                        border: "2px solid var(--gray-6)",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        textAlign: "center",
                        justifyContent: "center",
                        padding: "20px 24px",
                        height: "auto",
                        minHeight: "72px",
                        borderRadius: "12px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--blue-1)";
                        e.currentTarget.style.borderColor = "var(--blue-7)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 16px rgba(0, 0, 0, 0.12)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "white";
                        e.currentTarget.style.borderColor = "var(--gray-6)";
                        e.currentTarget.style.transform = "translateY(0px)";
                        e.currentTarget.style.boxShadow =
                          "0 2px 8px rgba(0, 0, 0, 0.06)";
                      }}
                    >
                      <Text
                        size="4"
                        weight="medium"
                        style={{ lineHeight: "1.4" }}
                      >
                        {message}
                      </Text>
                    </Button>
                  ))}
                </Flex>
              </Box>
            )}

            {/* Show banner at top if retry is active and no messages visible */}
            {showRetryBanner && visibleMessages.length === 0 && (
              <Box style={{ display: "flex", justifyContent: "flex-end" }}>
                <Box style={{ maxWidth: "70%" }}>
                  <LocalRetryBanner onUndo={undoRetry} />
                </Box>
              </Box>
            )}

            {visibleMessages.map((message) => {
              const isUserMessage =
                message.role === "user" ||
                message.persona_id === userPersona?.id;
              const isEmptyContent =
                !message.content || String(message.content).trim() === "";
              const hasTranscriptWords = Boolean(
                transcripts[message.id]?.words?.length
              );

              // Retry toggle data (computed once, used in both branches)
              const parentId = (
                message as unknown as { parent_id?: string | null }
              ).parent_id as string | null | undefined;
              const assistantParent = parentId
                ? (visibleMessages.find((m) => m.id === parentId) as
                    | (Message & { voice?: boolean })
                    | undefined)
                : undefined;
              const userVoice = Boolean(
                (message as unknown as { voice?: boolean }).voice
              );
              // Only allow "Retry from here" if this is a user message, it has a parent assistant,
              // and the user message was produced via voice:
              const showRetry =
                isUserMessage && userVoice && Boolean(assistantParent?.id);

              // Determine if we're in listening state
              const isListening =
                !message.completed && isEmptyContent && !hasTranscriptWords;

              return (
                <React.Fragment key={message.id}>
                  <Box>
                    {showRetry && (
                      <Flex
                        justify={isUserMessage ? "end" : "start"}
                        style={{ marginBottom: "6px" }}
                        gap="2"
                      >
                        <Button
                          size="1"
                          variant={
                            cutWin.cut.afterAssistantId === assistantParent?.id
                              ? "solid"
                              : "outline"
                          }
                          disabled={!assistantParent?.id}
                          onClick={() => {
                            if (!assistantParent?.id) return;
                            if (
                              cutWin.cut.afterAssistantId === assistantParent.id
                            ) {
                              // If already active, undo it
                              undoRetry();
                            } else {
                              // Start retry from this assistant, hiding this user message and everything after
                              cutWin.startRetry(assistantParent.id, message.id);
                              try {
                                setParentCursor(chat.id, assistantParent.id);
                              } catch {}
                            }
                          }}
                        >
                          {cutWin.cut.afterAssistantId === assistantParent?.id
                            ? "Retrying from here"
                            : "Retry from here"}
                        </Button>

                        {/* Explicit Undo button when active for extra clarity */}
                        {cutWin.cut.afterAssistantId ===
                          assistantParent?.id && (
                          <Button size="1" variant="ghost" onClick={undoRetry}>
                            Undo
                          </Button>
                        )}
                      </Flex>
                    )}
                    <Flex
                      direction={isUserMessage ? "row-reverse" : "row"}
                      align={isListening ? "center" : "start"}
                      gap="3"
                    >
                      {/* Avatar */}
                      <Card
                        size="1"
                        style={{
                          padding: "8px",
                          background: isUserMessage
                            ? "var(--blue-3)"
                            : "var(--green-3)",
                          border: `1px solid ${
                            isUserMessage ? "var(--blue-6)" : "var(--green-6)"
                          }`,
                          opacity: message.completed ? 1 : 0.6,
                        }}
                      >
                        {isUserMessage ? (
                          <PersonIcon color="var(--blue-9)" />
                        ) : (
                          <ChatBubbleIcon color="var(--green-9)" />
                        )}
                      </Card>

                      {/* Message Content - Single Card that morphs */}
                      <Box style={{ maxWidth: "70%" }}>
                        <Card
                          size="2"
                          style={{
                            background: isUserMessage
                              ? "var(--blue-2)"
                              : "var(--gray-2)",
                            border: `1px solid ${
                              isUserMessage ? "var(--blue-7)" : "var(--gray-7)"
                            }`,
                            paddingInline: isListening ? 4 : 16,
                            paddingBlock: isListening ? 0 : 18,
                            minHeight: 56,
                            minWidth: isListening ? 56 : undefined,
                            transition:
                              "opacity 180ms ease, transform 180ms ease",
                          }}
                        >
                          {/* Listening layer */}
                          <div
                            style={{
                              display: isListening ? "grid" : "none",
                              placeItems: "center",
                              height: 56,
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(
                                  isUserMessage ? 8 : 14,
                                  Math.min(
                                    isUserMessage ? 40 : 48,
                                    ((audioBufferRef.current[
                                      audioBufferRef.current.length - 1
                                    ] || 0) /
                                      255) *
                                      (isUserMessage ? 32 : 34) +
                                      (isUserMessage ? 8 : 14)
                                  )
                                )}px`,
                                height: `${Math.max(
                                  isUserMessage ? 8 : 14,
                                  Math.min(
                                    isUserMessage ? 40 : 48,
                                    ((audioBufferRef.current[
                                      audioBufferRef.current.length - 1
                                    ] || 0) /
                                      255) *
                                      (isUserMessage ? 32 : 34) +
                                      (isUserMessage ? 8 : 14)
                                  )
                                )}px`,
                                borderRadius: "50%",
                                background: isUserMessage
                                  ? "var(--blue-9)"
                                  : "var(--green-9)",
                                animation: "pulse 1.5s ease-in-out infinite",
                                transition: "width 0.1s ease, height 0.1s ease",
                              }}
                            />
                          </div>

                          {/* Text layer (always mounted) */}
                          <div
                            style={{
                              display: isListening ? "none" : "flex",
                              flexDirection: "column",
                              height: "100%",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}
                          >
                            <Text
                              size="1"
                              style={{ color: "var(--gray-11)" }}
                              weight="medium"
                            >
                              {isUserMessage
                                ? "You"
                                : personaMap.get(message.persona_id || "") ||
                                  "Assistant"}
                            </Text>
                            <Text
                              as="div"
                              size="3"
                              style={{
                                lineHeight: "1.6",
                                color: "var(--gray-12)",
                              }}
                            >
                              <div className="md-reset">
                                <Markdown>
                                  {renderMessageContent(message, {
                                    nowMs,
                                    transcripts,
                                    transcriptStops,
                                  })}
                                </Markdown>
                              </div>
                            </Text>
                          </div>
                        </Card>
                      </Box>
                    </Flex>
                  </Box>

                  {/* Show banner after this message if it's the last visible one and retry is active */}
                  {showRetryBanner && bannerAfterId === message.id && (
                    <Box
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 6,
                      }}
                    >
                      <Box style={{ maxWidth: "70%" }}>
                        <LocalRetryBanner onUndo={undoRetry} />
                      </Box>
                    </Box>
                  )}
                </React.Fragment>
              );
            })}

            <div ref={messagesEndRef} />
          </Flex>
        </Box>

        {/* Input Area */}
        {isSessionActive && (
          <Box
            style={{
              padding: "24px",
              background: "transparent",
              flexShrink: 0,
            }}
          >
            <Box
              style={{
                position: "relative",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              <Flex direction="column" gap="3">
                {/* Text Input with Voice Mode/Mic Controls and Hints */}
                <Flex align="center" gap="3">
                  {/* Voice Mode Button or Mic Controls - Left */}
                  {isRTCConnected ? (
                    <Tooltip.Provider>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <Button
                            onClick={onToggleMic}
                            disabled={!isRTCConnected}
                            size="2"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "12px 16px",
                              borderRadius: "12px",
                              width: "auto",
                              height: "48px",
                              fontSize: "14px",
                              fontWeight: 600,
                              background: micOn ? "#ef4444" : "white",
                              color: micOn ? "white" : "var(--gray-12)",
                              border: "1px solid var(--gray-6)",
                              cursor: !isRTCConnected
                                ? "not-allowed"
                                : "pointer",
                              outline: "none",
                              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                              transition: "all 0.2s ease",
                              flexShrink: 0,
                            }}
                          >
                            Voice Mode
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="TooltipContent"
                            sideOffset={5}
                            style={{
                              backgroundColor: "var(--gray-12)",
                              color: "white",
                              borderRadius: "6px",
                              padding: "8px 12px",
                              fontSize: "14px",
                              lineHeight: "1.4",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              zIndex: 1000,
                            }}
                          >
                            {micOn ? "Stop Recording" : "Start Recording"}
                            <Tooltip.Arrow style={{ fill: "var(--gray-12)" }} />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  ) : (
                    <Tooltip.Provider>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <Button
                            onClick={onToggleVoiceMode}
                            size="2"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              padding: "12px 16px",
                              borderRadius: "12px",
                              fontSize: "14px",
                              fontWeight: "600",
                              background: "white",
                              color: "var(--gray-12)",
                              border: "1px solid var(--gray-6)",
                              cursor: "pointer",
                              outline: "none",
                              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                              transition: "all 0.2s ease",
                              height: "48px",
                              flexShrink: 0,
                            }}
                          >
                            Voice Mode
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="TooltipContent"
                            sideOffset={5}
                            style={{
                              backgroundColor: "var(--gray-12)",
                              color: "white",
                              borderRadius: "6px",
                              padding: "8px 12px",
                              fontSize: "14px",
                              lineHeight: "1.4",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              zIndex: 1000,
                            }}
                          >
                            Click to enable voice mode and microphone access
                            <Tooltip.Arrow style={{ fill: "var(--gray-12)" }} />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </Tooltip.Provider>
                  )}

                  {/* Text Input - Center */}
                  <Box style={{ position: "relative", flex: 1 }}>
                    {micOn ? (
                      <Tooltip.Provider>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <div
                              style={{
                                width: "100%",
                                height: "48px",
                                borderRadius: "12px",
                                background: "transparent",
                                position: "relative",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <canvas
                                ref={waveformCanvasRef}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "block",
                                }}
                              />
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content
                              className="TooltipContent"
                              sideOffset={5}
                              style={{
                                backgroundColor: "var(--gray-12)",
                                color: "white",
                                borderRadius: "6px",
                                padding: "8px 12px",
                                fontSize: "14px",
                                lineHeight: "1.4",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                                zIndex: 1000,
                              }}
                            >
                              Microphone is active - speaking will be
                              transcribed automatically
                              <Tooltip.Arrow
                                style={{ fill: "var(--gray-12)" }}
                              />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="Type your message..."
                          value={currentMessage}
                          onChange={(e) => setCurrentMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              onSend();
                            }
                          }}
                          disabled={isSendingMessage}
                          style={{
                            width: "100%",
                            padding: "12px 50px 12px 16px",
                            borderRadius: "24px",
                            border: "1px solid var(--gray-6)",
                            fontSize: "16px",
                            outline: "none",
                            background: "white",
                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transition:
                              "border-color 0.2s ease, box-shadow 0.2s ease",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = "var(--blue-7)";
                            e.target.style.boxShadow =
                              "0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(59, 130, 246, 0.1)";
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "var(--gray-6)";
                            e.target.style.boxShadow =
                              "0 1px 3px rgba(0, 0, 0, 0.1)";
                          }}
                        />
                        <Button
                          onClick={() => onSend()}
                          disabled={!currentMessage.trim() || isSendingMessage}
                          size="1"
                          style={{
                            position: "absolute",
                            right: "6px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            borderRadius: "20px",
                            background:
                              currentMessage.trim() && !isSendingMessage
                                ? "var(--blue-9)"
                                : "var(--gray-6)",
                            border: "none",
                            width: "36px",
                            height: "36px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor:
                              currentMessage.trim() && !isSendingMessage
                                ? "pointer"
                                : "not-allowed",
                          }}
                        >
                          <PaperPlaneIcon width="16" height="16" />
                        </Button>
                      </>
                    )}
                  </Box>

                  {/* Hints Button - Right */}
                  {lastAIResponse && (
                    <Button
                      onClick={handleHintsClick}
                      variant="outline"
                      size="2"
                      disabled={isLoadingHints}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        border: "1px solid var(--gray-6)",
                        fontSize: "14px",
                        fontWeight: "500",
                        background: "white",
                        color: "var(--gray-12)",
                        cursor: isLoadingHints ? "not-allowed" : "pointer",
                        outline: "none",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        height: "48px",
                        flexShrink: 0,
                      }}
                    >
                      Hints
                    </Button>
                  )}
                </Flex>
              </Flex>
            </Box>
          </Box>
        )}

        {/* Hints Popup */}
        {showHints && (
          <Box
            style={{
              position: "fixed",
              top: "50%",
              right: "24px",
              transform: "translateY(-50%)",
              zIndex: 1000,
              maxWidth: "350px",
              width: "100%",
            }}
          >
            <Card
              size="3"
              style={{
                background: "white",
                border: "1px solid var(--purple-7)",
                boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
                borderRadius: "12px",
              }}
            >
              <Flex direction="column" gap="3">
                <Flex justify="between" align="center">
                  <Text
                    size="3"
                    weight="bold"
                    style={{ color: "var(--purple-9)" }}
                  >
                    Hints
                  </Text>
                  <Button
                    onClick={() => setShowHints(false)}
                    variant="ghost"
                    size="1"
                    style={{
                      color: "var(--gray-9)",
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </Button>
                </Flex>

                {(() => {
                  // Determine which hints to show based on difficulty setting
                  let hintsToShow: string[] = [];
                  let hasRealtimeHints = false;

                  if (hintsDifficulty === "hard") {
                    if (realtimeHighHints && realtimeHighHints.length > 0) {
                      hintsToShow = realtimeHighHints;
                      hasRealtimeHints = true;
                    }
                  } else {
                    if (realtimeLowHints && realtimeLowHints.length > 0) {
                      hintsToShow = realtimeLowHints;
                      hasRealtimeHints = true;
                    }
                  }

                  // Fallback to API hints if no realtime hints available
                  if (!hasRealtimeHints && hints && hints.length > 0) {
                    const filteredHints = hints.filter((h) =>
                      hintsDifficulty === "hard"
                        ? h.difficulty === "high"
                        : h.difficulty === "low"
                    );
                    hintsToShow = filteredHints.map(
                      (h) => h.contents?.join("\n\n") || ""
                    );
                  }

                  if (hintsToShow.length > 0) {
                    return (
                      <Box>
                        <Text
                          size="2"
                          style={{ lineHeight: "1.5", color: "var(--gray-12)" }}
                        >
                          <Markdown>{hintsToShow.join("\n\n")}</Markdown>
                        </Text>
                      </Box>
                    );
                  } else {
                    return (
                      <Text size="2" style={{ color: "var(--gray-11)" }}>
                        {isLoadingHints
                          ? "Generating hints..."
                          : `No ${hintsDifficulty} hints available`}
                      </Text>
                    );
                  }
                })()}

                {/* Toggle switch in bottom right */}
                <Flex
                  justify="end"
                  align="center"
                  gap="2"
                  style={{ marginTop: "8px" }}
                >
                  <Switch
                    checked={hintsDifficulty === "easy"}
                    onCheckedChange={(checked) =>
                      setHintsDifficulty(checked ? "easy" : "hard")
                    }
                  />
                  <Text size="1" style={{ color: "var(--gray-10)" }}>
                    Easy
                  </Text>
                </Flex>
              </Flex>
            </Card>
          </Box>
        )}

        {isEndingSession && (
          <Box
            style={{
              padding: "24px",
              background: "var(--gray-1)",
              flexShrink: 0,
            }}
          >
            <Card
              size="2"
              style={{
                background: "var(--amber-2)",
                border: "1px solid var(--amber-7)",
              }}
            >
              <Text
                size="2"
                align="center"
                style={{ color: "var(--amber-11)" }}
              >
                Generating feedback...
              </Text>
            </Card>
          </Box>
        )}
      </Box>
    </>
  );
}

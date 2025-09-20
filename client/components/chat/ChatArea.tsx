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
import { Box, Button, Card, Flex, Switch, Text } from "@radix-ui/themes";
// Removed mic icons in favor of a consistent "Voice Mode" label
import React, { useCallback, useEffect, useState } from "react";
import IntroMessageModal from "./IntroMessageModal";

// Import necessary hooks
import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { useLatestMessageHints } from "@/lib/api/hooks/useHints";
import { usePersonas, useUserPersona } from "@/lib/api/hooks/usePersonas";
interface ChatAreaProps {
  displayMessages: Message[];
  isSendingMessage: boolean;
  isEndingSession: boolean;
  isSessionActive: boolean;
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chat: Chat;
  onShowFeedback?: () => void;
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
  onShowFeedback,
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
    isRoomJoined,
    toggleMic,
    sendWebRTCMessage,
    getLocalMicStream,
  } = useWebSocket();

  // Auto-enable voice mode once per chat
  const autoEnableVoiceModeRef = React.useRef<string | null>(null);

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

  // Lightweight render clock (~30fps)
  useEffect(() => {
    let raf: number | null = null;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 33) {
        setNowMs(Date.now());
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [chat?.id, transcripts]);

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
      setTranscripts((prev) => ({
        ...prev,
        [d.message_id as string]: {
          start_ts_ms: Number(d.start_ts_ms) || Date.now(),
          words: Array.isArray(d.words) ? d.words : [],
          text: String(d.text || ""),
        },
      }));
    };

    const onAgentTranscriptStop = (evt: Event) => {
      const e = evt as CustomEvent;
      const d = (e.detail || {}) as {
        message_id?: string | null;
        stop_ts_ms: number;
      };
      if (!d.message_id) return;
      setTranscriptStops((prev) => ({
        ...prev,
        [d.message_id as string]: Number(d.stop_ts_ms) || Date.now(),
      }));
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
  }, []);

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
    displayMessages, // seed from props for instant pick
    true // enabled
  );

  // Get the current user and their associated persona
  const { user } = useAuth();
  const { data: userPersona } = useUserPersona(user?.id);
  const { data: allPersonas } = usePersonas();

  // Scenario association - use chat.scenario_id directly
  const scenarioId: string | undefined = chat?.scenario_id || undefined;

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
    const lastMessage = displayMessages[displayMessages.length - 1];
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
  }, [displayMessages, lastAIResponse]);

  // Request hints when the assistant signals it's DONE
  useEffect(() => {
    const onComplete = (e: CustomEvent) => {
      const d = e.detail || {};
      const chatId = d.chatId ?? d.chat_id;
      const messageId = d.messageId ?? d.message_id;
      const finalContent = d.finalContent ?? d.final_content;
      if (!chat?.id || chatId !== chat.id || !messageId) return;
      // Update local state for UI - hints will be fetched automatically by the hook
      setLastAIResponse(finalContent || "");
      setLastAssistantId(messageId);
      setRealtimeLowHints(null); // Clear any previous real-time hints
      setRealtimeHighHints(null); // Clear any previous real-time hints
    };

    window.addEventListener(
      "trainingMessageComplete",
      onComplete as EventListener
    );
    return () => {
      window.removeEventListener(
        "trainingMessageComplete",
        onComplete as EventListener
      );
    };
  }, [chat?.id]);

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

    const draw = () => {
      if (!canvas || !canvasCtx || !analyserRef.current) return;

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

      // Schedule next update based on time interval instead of animation frame
      setTimeout(() => {
        if (micOn) {
          rafRef.current = requestAnimationFrame(draw);
        }
      }, updateInterval);
    };

    draw();

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
  const onSend = useCallback(async () => {
    const message = currentMessage.trim();
    if (!message || !chat?.id) return;

    // Try to unlock audio on first user interaction
    try {
      const el = document.querySelector("audio") as HTMLAudioElement;
      if (el) {
        el.muted = false;
        await el.play();
      }
    } catch (error) {
      console.error("Failed to unlock audio on message send", error);
    }

    // Ensure room join just in case (idempotent, cheap)
    joinRoom(chat.id);
    // Prefer to wait briefly for RTC setup so we don't miss audio reply
    await waitForVoiceReady(1500);
    // sendWebRTCMessage will still fallback to socket if DC isn't ready
    sendWebRTCMessage(chat.id, message);
    setCurrentMessage("");
  }, [
    chat?.id,
    currentMessage,
    joinRoom,
    sendWebRTCMessage,
    setCurrentMessage,
    waitForVoiceReady,
  ]);

  // ────────────────────────────────────────────────────────────────────────────
  // Intro Message Modal (moved from TrainingAttempt)
  // ────────────────────────────────────────────────────────────────────────────
  const [showIntroModal, setShowIntroModal] = useState(false);
  const hasShownIntroModalRef = React.useRef<string | null>(null);

  // Open intro modal once per chat when there are zero messages, AFTER confirmed room join
  useEffect(() => {
    if (!chat?.id) return;
    if (hasShownIntroModalRef.current === chat.id) return;
    // Debounce to allow messages to sync and room ack to arrive
    const t = setTimeout(() => {
      if (displayMessages.length === 0 && isRoomJoined(chat.id)) {
        hasShownIntroModalRef.current = chat.id;
        setShowIntroModal(true);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [chat?.id, displayMessages.length, isRoomJoined]);

  const handleIntroMessageSelect = useCallback(
    async (message: string) => {
      if (!chat?.id) return;
      try {
        // Ensure room membership
        joinRoom(chat.id);
        // Ensure RTC/audio is ready so we hear the first response
        await waitForVoiceReady(1500);
        // Send (RTC DC preferred, websocket fallback ok)
        sendWebRTCMessage(chat.id, message);
      } finally {
        setShowIntroModal(false);
      }
    },
    [chat?.id, joinRoom, sendWebRTCMessage, waitForVoiceReady]
  );

  // Close intro modal automatically if messages appear (e.g., from another tab or delayed fetch)
  useEffect(() => {
    if (showIntroModal && displayMessages.length > 0) {
      setShowIntroModal(false);
    }
  }, [showIntroModal, displayMessages.length]);

  // Auto-show feedback modal when chat is completed and feedback exists
  useEffect(() => {
    if (chat?.completed && onShowFeedback) {
      // Check if feedback exists by looking at the chat's feedback property
      const chatWithIncludes = chat as { feedback?: unknown[] };
      const hasFeedback =
        chatWithIncludes?.feedback && chatWithIncludes.feedback.length > 0;

      if (hasFeedback) {
        // Add a small delay to ensure the UI has updated
        const timer = setTimeout(() => {
          onShowFeedback();
        }, 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [chat, onShowFeedback]);

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
          style={{
            flex: 1,
            padding: "24px",
            overflow: "auto",
            background: "white",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Flex direction="column" gap="4">
            {displayMessages.map((message) => {
              const isUserMessage =
                message.role === "user" ||
                message.persona_id === userPersona?.id;
              const isAssistantMessage = message.role === "assistant";
              const isEmptyContent =
                !message.content || String(message.content).trim() === "";
              const hasTranscriptWords = Boolean(
                transcripts[message.id]?.words?.length
              );

              // Show either the full message card OR the pulsating circle for empty messages
              if (!message.completed && isEmptyContent && !hasTranscriptWords) {
                // Show pulsating circle for in-progress empty message (user or assistant)
                return (
                  <Box key={message.id}>
                    <Flex
                      direction={isUserMessage ? "row-reverse" : "row"}
                      align="center"
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
                          opacity: 0.8,
                        }}
                      >
                        {isUserMessage ? (
                          <PersonIcon color="var(--blue-9)" />
                        ) : (
                          <ChatBubbleIcon color="var(--green-9)" />
                        )}
                      </Card>

                      {/* Pulsating Circle */}
                      <Box style={{ maxWidth: "30%" }}>
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
                      </Box>
                    </Flex>
                  </Box>
                );
              }

              // Show normal message card for all other messages
              return (
                <Box key={message.id}>
                  <Flex
                    direction={isUserMessage ? "row-reverse" : "row"}
                    align="start"
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

                    {/* Message Content */}
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
                          opacity: message.completed ? 1 : 0.8,
                        }}
                      >
                        <Flex direction="column" gap="2">
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
                            size="2"
                            style={{
                              lineHeight: "1.5",
                              color: "var(--gray-12)",
                            }}
                          >
                            <Markdown>
                              {(() => {
                                // Prefer transcript-driven progressive rendering if present
                                const tr = transcripts[message.id];
                                if (
                                  tr &&
                                  isAssistantMessage &&
                                  Array.isArray(tr.words) &&
                                  tr.words.length > 0
                                ) {
                                  const start = Number(tr.start_ts_ms) || 0;
                                  const stop = transcriptStops[message.id];
                                  let elapsed = nowMs - start;
                                  if (Number.isFinite(stop)) {
                                    elapsed = Math.min(elapsed, stop - start);
                                  }
                                  if (elapsed <= 0) return "";
                                  const visible = tr.words
                                    .filter((w) => w.start_ms <= elapsed)
                                    .map((w) => w.text);
                                  return visible
                                    .join(" ")
                                    .replace(/\s+([,.;!?])/g, "$1");
                                }
                                // Historical DB render with interruption clamp via word_timestamps
                                try {
                                  const isAssistant = isAssistantMessage;
                                  const wtAny = (
                                    message as unknown as {
                                      word_timestamps?: unknown;
                                    }
                                  ).word_timestamps;
                                  const hasWT =
                                    Array.isArray(wtAny) && wtAny.length > 0;
                                  const interruption = (
                                    message as unknown as {
                                      interruption_ms?: number | null;
                                    }
                                  ).interruption_ms;

                                  if (
                                    isAssistant &&
                                    hasWT &&
                                    typeof interruption === "number" &&
                                    interruption > 0
                                  ) {
                                    // interruption_ms is already relative to message created_at (stored in DB)
                                    const cutoffRel = interruption;

                                    // Debug logging for troubleshooting
                                    if (
                                      process.env.NODE_ENV === "development"
                                    ) {
                                      console.log(
                                        `[ChatArea] Processing interruption for message ${message.id}:`,
                                        {
                                          interruption_ms: interruption,
                                          cutoffRel,
                                          wordCount: Array.isArray(wtAny)
                                            ? wtAny.length
                                            : 0,
                                          hasWordTimestamps: hasWT,
                                        }
                                      );
                                    }

                                    const words: {
                                      start_ms: number;
                                      end_ms: number;
                                      text: string;
                                    }[] = (wtAny as Array<unknown>)
                                      .map((w) => {
                                        const obj = w as {
                                          start_ms?: unknown;
                                          end_ms?: unknown;
                                          text?: unknown;
                                        };
                                        return {
                                          start_ms: Number(
                                            (obj && obj.start_ms) ?? 0
                                          ),
                                          end_ms: Number(
                                            (obj && obj.end_ms) ?? 0
                                          ),
                                          text: String((obj && obj.text) ?? ""),
                                        };
                                      })
                                      .filter(
                                        (w) =>
                                          Number.isFinite(w.start_ms) &&
                                          Number.isFinite(w.end_ms) &&
                                          !!w.text
                                      );

                                    if (words.length > 0) {
                                      // Find the last word that would have been spoken before interruption
                                      // Sort words by start_ms to ensure proper order
                                      const sortedWords = words.sort(
                                        (a, b) => a.start_ms - b.start_ms
                                      );

                                      // Find the last word that would have been completed before interruption
                                      const visibleWords = sortedWords.filter(
                                        (w) => w.end_ms <= cutoffRel
                                      );

                                      if (visibleWords.length > 0) {
                                        const result = visibleWords
                                          .map((w) => w.text)
                                          .join(" ")
                                          .replace(/\s+([,.;!?])/g, "$1");

                                        // Debug logging for troubleshooting
                                        if (
                                          process.env.NODE_ENV === "development"
                                        ) {
                                          console.log(
                                            `[ChatArea] Interruption result for message ${message.id}:`,
                                            {
                                              visibleWordsCount:
                                                visibleWords.length,
                                              totalWordsCount:
                                                sortedWords.length,
                                              result:
                                                result.substring(0, 100) +
                                                (result.length > 100
                                                  ? "..."
                                                  : ""),
                                            }
                                          );
                                        }

                                        return result;
                                      }
                                    }
                                  }
                                } catch {}

                                return message.content || "";
                              })()}
                            </Markdown>
                          </Text>
                        </Flex>
                      </Card>
                    </Box>
                  </Flex>
                </Box>
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
                          onClick={onSend}
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
      {/* Intro Message Modal */}
      <IntroMessageModal
        isOpen={showIntroModal}
        onClose={() => setShowIntroModal(false)}
        onSelectMessage={handleIntroMessageSelect}
      />
    </>
  );
}

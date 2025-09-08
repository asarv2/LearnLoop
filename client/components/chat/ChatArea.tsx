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
import { Box, Button, Card, Flex, Text } from "@radix-ui/themes";
import { Mic, MicOff } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

// Import necessary hooks
import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { useLatestMessageHints } from "@/lib/api/hooks/useHints";
import { usePersonas, useUserPersona } from "@/lib/api/hooks/usePersonas";
import { useScenario } from "@/lib/api/hooks/useScenarios";
interface ChatAreaProps {
  displayMessages: Message[];
  isSendingMessage: boolean;
  isEndingInterview: boolean;
  isInterviewActive: boolean;
  currentMessage: string;
  setCurrentMessage: (message: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chat: Chat;
}

export default function ChatArea({
  displayMessages,
  isSendingMessage,
  isEndingInterview,
  isInterviewActive,
  currentMessage,
  setCurrentMessage,
  messagesEndRef,
  chat,
}: ChatAreaProps) {
  // WebSocket context
  const {
    isRTCConnected,
    micOn,
    voiceMode,
    enableVoiceMode,
    toggleMic,
    sendWebRTCMessage,
    getLocalMicStream,
  } = useWebSocket();

  // Auto-enable voice mode once per chat
  const autoEnableVoiceModeRef = React.useRef<string | null>(null);

  // Hints-related state
  const [showHints, setShowHints] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState<string>("");
  const [realtimeHints, setRealtimeHints] = useState<string[] | null>(null);
  const [lastAssistantId, setLastAssistantId] = useState<string | null>(null);

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

  // Scenario association (optional until schema lands)
  const scenarioId: string | undefined =
    (
      chat as unknown as {
        scenario_id?: string | null;
      }
    )?.scenario_id || undefined;
  useScenario(scenarioId || "", Boolean(scenarioId));

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
      setRealtimeHints(null); // Clear any previous real-time hints
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
      const { hints, messageId } = event.detail || {};
      if (!messageId || messageId !== lastAssistantId) return; // only accept newest
      if (hints && Array.isArray(hints)) {
        setRealtimeHints(hints);
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
    if (!voiceMode) {
      // turning ON: establish RTC once and leave it until refresh
      enableVoiceMode(chat.id);
    } else {
      // turning OFF: do NOT disconnect; just stop using RTC for text
      // (Audio/mic stays as last set)
    }
  }, [chat?.id, voiceMode, enableVoiceMode]);

  // Automatically enable voice mode when chat becomes available (id changes)
  useEffect(() => {
    if (!chat?.id) return;
    if (autoEnableVoiceModeRef.current === chat.id) return;
    autoEnableVoiceModeRef.current = chat.id;
    if (!voiceMode) enableVoiceMode(chat.id);
  }, [chat?.id, voiceMode, enableVoiceMode]);

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

  // Send message handler
  const onSend = useCallback(() => {
    const message = currentMessage.trim();
    if (!message || !chat?.id) return;

    if (!voiceMode) return; // prevent sending when voice mode is OFF
    // realtime path (DC preferred, websocket fallback inside)
    sendWebRTCMessage(chat.id, message);
    setCurrentMessage("");
  }, [
    chat?.id,
    currentMessage,
    voiceMode,
    sendWebRTCMessage,
    setCurrentMessage,
  ]);

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

              // Show either the full message card OR the pulsating circle for empty user messages
              if (!message.completed && !message.content && isUserMessage) {
                // Show pulsating circle for empty user message
                return (
                  <Box key={message.id}>
                    <Flex direction="row-reverse" align="center" gap="3">
                      {/* Avatar */}
                      <Card
                        size="1"
                        style={{
                          padding: "8px",
                          background: "var(--blue-3)",
                          border: "1px solid var(--blue-6)",
                          opacity: 0.8,
                        }}
                      >
                        <PersonIcon color="var(--blue-9)" />
                      </Card>

                      {/* Pulsating Circle */}
                      <Box style={{ maxWidth: "30%" }}>
                        <div
                          style={{
                            width: `${Math.max(
                              8,
                              Math.min(
                                40,
                                ((audioBufferRef.current[
                                  audioBufferRef.current.length - 1
                                ] || 0) /
                                  255) *
                                  32 +
                                  8
                              )
                            )}px`,
                            height: `${Math.max(
                              8,
                              Math.min(
                                40,
                                ((audioBufferRef.current[
                                  audioBufferRef.current.length - 1
                                ] || 0) /
                                  255) *
                                  32 +
                                  8
                              )
                            )}px`,
                            borderRadius: "50%",
                            background: "var(--blue-9)",
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
                              {!message.completed &&
                              !message.content &&
                              isAssistantMessage
                                ? `${
                                    personaMap.get(message.persona_id || "") ||
                                    "Assistant"
                                  } is thinking...`
                                : message.content || ""}
                            </Markdown>
                          </Text>
                          {message.completed && (
                            <Text size="1" style={{ color: "var(--gray-11)" }}>
                              {new Date(
                                message.created_at
                              ).toLocaleTimeString()}
                            </Text>
                          )}
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
        {isInterviewActive && (
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
                  {voiceMode ? (
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
                              padding: 0,
                              borderRadius: "12px",
                              width: "48px",
                              height: "48px",
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
                            {micOn ? <MicOff size={16} /> : <Mic size={16} />}
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
                          disabled={
                            !voiceMode ||
                            !currentMessage.trim() ||
                            isSendingMessage
                          }
                          size="1"
                          style={{
                            position: "absolute",
                            right: "6px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            borderRadius: "20px",
                            background:
                              currentMessage.trim() &&
                              !isSendingMessage &&
                              voiceMode
                                ? "var(--blue-9)"
                                : "var(--gray-6)",
                            border: "none",
                            width: "36px",
                            height: "36px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor:
                              currentMessage.trim() &&
                              !isSendingMessage &&
                              voiceMode
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

                {realtimeHints && realtimeHints.length > 0 ? (
                  <Box>
                    <Text
                      size="2"
                      style={{ lineHeight: "1.5", color: "var(--gray-12)" }}
                    >
                      <Markdown>{realtimeHints.join("\n\n")}</Markdown>
                    </Text>
                  </Box>
                ) : hints && hints.length > 0 ? (
                  <Box>
                    <Text
                      size="2"
                      style={{ lineHeight: "1.5", color: "var(--gray-12)" }}
                    >
                      <Markdown>
                        {hints
                          .map((h) => h.contents?.join("\n\n") || "")
                          .join("\n\n")}
                      </Markdown>
                    </Text>
                  </Box>
                ) : (
                  <Text size="2" style={{ color: "var(--gray-11)" }}>
                    {isLoadingHints
                      ? "Generating hints..."
                      : "No hints available"}
                  </Text>
                )}
              </Flex>
            </Card>
          </Box>
        )}

        {isEndingInterview && (
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

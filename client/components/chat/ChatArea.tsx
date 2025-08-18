/**
 * ChatArea.tsx
 * Unified text and voice chat interface using WebRTC for audio
 *
 * ✅ IMPLEMENTED: Server VAD (Voice Activity Detection)
 * - Uses server-side VAD for automatic turn detection
 * - PTT (Push-to-Talk) only controls track.enabled
 * - No manual finalization needed - server handles turn management
 * - Supports barge-in (user can interrupt assistant)
 *
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

import Markdown from "@/components/common/Markdown";
import { Chat, Message } from "@/types";
import {
  ChatBubbleIcon,
  InfoCircledIcon,
  PaperPlaneIcon,
  Pencil1Icon,
  PersonIcon,
  SpeakerLoudIcon,
} from "@radix-ui/react-icons";
import { Box, Button, Card, Flex, Text } from "@radix-ui/themes";
import React, { useCallback, useEffect, useRef, useState } from "react";

// ✨ Import necessary hooks
import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { usePersonas, useUserPersona } from "@/lib/api/hooks/usePersonas";
import { trainingMessageKeys } from "@/lib/api/hooks/useTrainingMessages";
import { logError, logInfo } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import WebRTCDebugPanel from "./WebRTCDebugPanel";

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
  // Mode toggle state
  const [isVoiceMode, setIsVoiceMode] = useState(false);

  // WebRTC audio state
  const {
    isWebRTCConnected,
    isAudioBridgeReady, // ✨ Get the new state from the context
    initializeAudioStream,
    setMicrophoneMuted,
    terminateAudioStream,
    sendWebRTCMessage,
    audioPlaybackRef,
    enableServerAudio,
    disableServerAudio,
    triggerServerAudio,
    emitGetHints, // ✨ Add hints emitter
  } = useWebSocket();

  // Voice-related state
  const queryClient = useQueryClient();
  const [micActive, setMicActive] = useState(false);
  const lastFinalizeTimeRef = useRef<number>(0); // Track last finalize call time for debouncing

  // Hints-related state
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<string>("");
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState<string>("");

  // ✨ Get the current user and their associated persona
  const { user } = useAuth();
  const { data: userPersona } = useUserPersona(user?.id);
  const { data: allPersonas } = usePersonas();

  // ✨ 1. Create a memoized map for efficient and stable persona lookup.
  // This prevents re-calculations on every render and ensures consistency.
  const personaMap = React.useMemo(() => {
    if (!allPersonas) return new Map<string, string>();
    return new Map(allPersonas.map((p) => [p.id, p.name]));
  }, [allPersonas]);

  // 👇 DEPRECATED: The patchCache function is no longer needed.
  // We will handle the logic directly in the send function for more control.

  // Generate hints function using WebSocket
  const generateHints = useCallback(async () => {
    if (!lastAIResponse || !displayMessages.length) return;

    // Find the last assistant message to get its ID
    const lastAssistantMessage = displayMessages
      .filter((msg) => msg.role === "assistant")
      .pop();

    if (!lastAssistantMessage?.id) {
      logError("No assistant message found for hints generation");
      return;
    }

    // Use WebSocket to get hints
    if (chat?.id) {
      emitGetHints({
        chat_id: chat.id,
        message_id: lastAssistantMessage.id,
      });
    }
  }, [lastAIResponse, displayMessages, chat?.id, emitGetHints]);

  // Handle hints button click
  const handleHintsClick = useCallback(async () => {
    if (!showHints && !hints && lastAIResponse) {
      setIsLoadingHints(true);
      await generateHints();
    }
    setShowHints(!showHints);
  }, [showHints, hints, lastAIResponse, generateHints]);

  // Track if we're currently in a room to prevent duplicate joins
  // ❌ REMOVED: currentRoomRef - no longer needed since room management is centralized

  // Ensure audio element is properly configured for server audio
  useEffect(() => {
    const audio = audioPlaybackRef.current;
    if (audio) {
      // Set volume but keep muted initially - will be controlled by voice mode
      audio.volume = 1;
      logInfo("Audio element configured for server playback", {
        muted: audio.muted,
        volume: audio.volume,
        readyState: audio.readyState,
      });
    }
  }, [audioPlaybackRef]);

  // ❌ REMOVED: Duplicate join/leave logic - now handled by useTrainingMessages hook
  // This prevents race conditions on page refresh where multiple components
  // try to join the same room simultaneously

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
        setHints("");
      }
    }
  }, [displayMessages, lastAIResponse]);

  // ✅ NEW: Listen for server VAD events for UI feedback
  useEffect(() => {
    const handleServerVADEvent = (event: CustomEvent) => {
      const { type } = event.detail;
      if (type === "input_audio_buffer.speech_started") {
        logInfo("Server VAD: Speech started");
        // Could add UI feedback here like showing a "listening" indicator
      } else if (type === "input_audio_buffer.speech_stopped") {
        logInfo("Server VAD: Speech stopped");
        // Could add UI feedback here like showing a "thinking" indicator
      }
    };

    const handleAudioInterrupted = () => {
      logInfo(
        "Audio interrupted - user started speaking while assistant was talking"
      );
      // Stop any ongoing audio playback when user barges in
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
        audioPlaybackRef.current.currentTime = 0;
      }
    };

    const handleHintsGenerated = (event: CustomEvent) => {
      const { hints } = event.detail;
      if (hints && Array.isArray(hints)) {
        setHints(hints.join("\n\n")); // Join hints with double newlines
        setIsLoadingHints(false);
      }
    };

    // Listen for server VAD events
    window.addEventListener(
      "server_vad_event",
      handleServerVADEvent as EventListener
    );
    window.addEventListener(
      "audio_interrupted",
      handleAudioInterrupted as EventListener
    );
    window.addEventListener(
      "hintsGenerated",
      handleHintsGenerated as EventListener
    );

    return () => {
      window.removeEventListener(
        "server_vad_event",
        handleServerVADEvent as EventListener
      );
      window.removeEventListener(
        "audio_interrupted",
        handleAudioInterrupted as EventListener
      );
      window.removeEventListener(
        "hintsGenerated",
        handleHintsGenerated as EventListener
      );
    };
  }, [audioPlaybackRef]);

  // 👇 DEPRECATED: We will no longer re-sort the array on every render.
  /*
  const getCombinedMessages = useCallback(() => {
    const messages = [...displayMessages];
    return messages.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [displayMessages]);
  */

  // ✅ ENHANCED: Voice mode toggle now handles audio playback setup
  const handleModeToggle = useCallback(async () => {
    const nextIsVoiceMode = !isVoiceMode;
    setIsVoiceMode(nextIsVoiceMode);
    setCurrentMessage("");

    if (nextIsVoiceMode) {
      // ✅ STEP 1: Enable server audio playback immediately on click.
      // This is a valid user gesture, so the .play() call inside enableServerAudio will work.
      enableServerAudio();

      // ✅ STEP 2: Initialize the microphone stream as before.
      if (chat?.id) {
        await initializeAudioStream(chat.id);
        // This is still useful to prime the connection if needed.
        triggerServerAudio();
      }
    } else {
      // Cleanup remains the same when leaving voice mode.
      if (chat?.id) {
        disableServerAudio();
        terminateAudioStream(chat.id);
        setMicActive(false);
      }
    }
  }, [
    isVoiceMode,
    chat?.id,
    setCurrentMessage,
    enableServerAudio,
    initializeAudioStream,
    triggerServerAudio,
    disableServerAudio,
    terminateAudioStream,
  ]);

  // ✅ FIX: PTT now creates an optimistic message for immediate UI feedback
  const handleVoiceStart = useCallback(() => {
    setMicrophoneMuted(false);
    setMicActive(true);
    logInfo("Microphone enabled for voice input.");

    // ✅ FIX: Create an optimistic user message placeholder
    if (chat?.id && userPersona?.id) {
      const queryKey = trainingMessageKeys.list(chat.id);
      const tempId = `temp-voice-${Date.now()}`;

      queryClient.setQueryData<Message[]>(queryKey, (old = []) => [
        ...old,
        {
          id: tempId,
          role: "user",
          persona_id: userPersona.id,
          content: "🎤 Listening...", // Placeholder content
          completed: false, // It's not completed yet
          created_at: new Date().toISOString(),
          chat_id: chat.id,
        } as Message,
      ]);
    }
  }, [setMicrophoneMuted, chat?.id, userPersona?.id, queryClient]);

  const handleVoiceStop = useCallback(() => {
    // Only process if the mic was actually active
    if (!micActive) return;

    // Prevent rapid successive calls (debounce)
    const now = Date.now();
    if (now - lastFinalizeTimeRef.current < 100) return; // 100ms debounce
    lastFinalizeTimeRef.current = now;

    // ✅ FIX: With server VAD, we only need to mute the microphone
    // The server will automatically detect when speech stops
    setMicrophoneMuted(true);
    setMicActive(false);

    // ❌ REMOVED: No need to emit finalize turn - server VAD handles this automatically
  }, [setMicrophoneMuted, micActive]);

  // Handle WebRTC text message sending
  // ✅ FIX: Only create optimistic user message, assistant message will be added by server
  const handleWebRTCTextMessage = useCallback(
    (message: string) => {
      if (!chat?.id || !message.trim() || !userPersona?.id) return;

      sendWebRTCMessage(chat.id, message);

      const queryKey = trainingMessageKeys.list(chat.id);
      const baseTimestamp = new Date();
      const tempUserId = `temp-${baseTimestamp.getTime()}`;

      // ✅ FIX: Only add the optimistic USER message
      queryClient.setQueryData<Message[]>(queryKey, (old = []) => [
        ...old,
        {
          id: tempUserId,
          role: "user",
          persona_id: userPersona.id,
          content: message,
          completed: true,
          created_at: baseTimestamp.toISOString(),
          chat_id: chat.id,
        } as Message,
      ]);

      setCurrentMessage("");
    },
    [
      chat?.id,
      sendWebRTCMessage,
      queryClient,
      setCurrentMessage,
      userPersona?.id,
    ]
  );

  // ✨ 3. Use the memoized map in the lookup function for stability.
  const getPersonaName = useCallback(
    (personaId: string | null) => {
      if (!personaId) return null;
      return personaMap.get(personaId) || null;
    },
    [personaMap] // Dependency is now the stable map
  );

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
    <Box
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "transparent",
        overflow: "hidden",
      }}
    >
      {/* Audio element moved to global provider to avoid race conditions */}

      {/* Messages */}
      <Box
        style={{
          flex: 1,
          padding: "24px",
          overflow: "auto",
          background: "white",
        }}
      >
        <Flex direction="column" gap="4">
          {/* ✨ FIX: Map directly over the displayMessages prop */}
          {displayMessages.map((message) => {
            // Determine if this is a user message or assistant message
            const isUserMessage = message.persona_id === userPersona?.id;
            const isAssistantMessage = message.role === "assistant";

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
                          {/* Handle generic assistant persona */}
                          {isUserMessage
                            ? "You"
                            : getPersonaName(message.persona_id) || "Assistant"}
                        </Text>
                        <Text
                          size="2"
                          style={{ lineHeight: "1.5", color: "var(--gray-12)" }}
                        >
                          <Markdown>
                            {/* Handle "thinking" message for assistant */}
                            {!message.completed &&
                            !message.content &&
                            isAssistantMessage
                              ? `${
                                  getPersonaName(message.persona_id) ||
                                  "Assistant"
                                } is thinking...`
                              : message.content || ""}
                          </Markdown>
                        </Text>
                        {message.completed && (
                          <Text size="1" style={{ color: "var(--gray-11)" }}>
                            {new Date(message.created_at).toLocaleTimeString()}
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
              {/* Mode Toggle */}
              <Flex justify="center" gap="2">
                <Button
                  onClick={handleModeToggle}
                  variant={isVoiceMode ? "outline" : "solid"}
                  size="2"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "20px",
                    background: !isVoiceMode ? "var(--blue-9)" : "transparent",
                    color: !isVoiceMode ? "white" : "var(--blue-9)",
                    border: `1px solid var(--blue-9)`,
                    cursor: "pointer",
                  }}
                >
                  <Pencil1Icon width="16" height="16" />
                  Text
                </Button>
                <Button
                  onClick={handleModeToggle}
                  variant={!isVoiceMode ? "outline" : "solid"}
                  size="2"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "20px",
                    background: isVoiceMode ? "var(--green-9)" : "transparent",
                    color: isVoiceMode ? "white" : "var(--green-9)",
                    border: `1px solid var(--green-9)`,
                    cursor: "pointer",
                  }}
                >
                  <SpeakerLoudIcon width="16" height="16" />
                  Voice
                </Button>
                {/* Hints Button */}
                {lastAIResponse && (
                  <Button
                    onClick={handleHintsClick}
                    variant="outline"
                    size="2"
                    disabled={isLoadingHints}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 1rem",
                      borderRadius: "20px",
                      background: "transparent",
                      color: "var(--purple-9)",
                      border: `1px solid var(--purple-9)`,
                      cursor: isLoadingHints ? "not-allowed" : "pointer",
                    }}
                  >
                    <InfoCircledIcon width="16" height="16" />
                    {isLoadingHints
                      ? "Loading..."
                      : hints
                      ? "Hints"
                      : "Get Hints"}
                  </Button>
                )}
              </Flex>

              {isVoiceMode ? (
                // Voice Input with WebRTC
                <Flex direction="column" gap="3" align="center">
                  {/* Voice Button */}
                  <Button
                    onMouseDown={handleVoiceStart}
                    onMouseUp={handleVoiceStop}
                    onMouseLeave={handleVoiceStop}
                    onTouchStart={handleVoiceStart} // For mobile
                    onTouchEnd={handleVoiceStop}
                    // ✅ FIX: Disable the button until BOTH WebRTC is connected AND the audio bridge is ready.
                    disabled={!isWebRTCConnected || !isAudioBridgeReady}
                    size="3"
                    style={{
                      padding: "1rem 2rem",
                      borderRadius: "30px",
                      background: micActive
                        ? "linear-gradient(135deg, #ef4444, #dc2626)"
                        : !isWebRTCConnected || !isAudioBridgeReady
                        ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                        : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "white",
                      border: "none",
                      cursor:
                        !isWebRTCConnected || !isAudioBridgeReady
                          ? "not-allowed"
                          : "pointer",
                      fontSize: "1rem",
                      fontWeight: "600",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: micActive
                        ? "0 8px 30px rgba(239, 68, 68, 0.4)"
                        : !isWebRTCConnected || !isAudioBridgeReady
                        ? "0 4px 15px rgba(156, 163, 175, 0.3)"
                        : "0 8px 30px rgba(99, 102, 241, 0.3)",
                      transform: micActive ? "scale(1.05)" : "scale(1)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>
                      {micActive
                        ? "🔴"
                        : !isWebRTCConnected || !isAudioBridgeReady
                        ? "⏳"
                        : "🎤"}
                    </span>
                    {micActive
                      ? "Listening..."
                      : !isWebRTCConnected || !isAudioBridgeReady
                      ? "Connecting..."
                      : "Hold to Speak"}
                  </Button>

                  {(!isWebRTCConnected || !isAudioBridgeReady) && (
                    <Text size="2" style={{ color: "var(--amber-11)" }}>
                      Connecting to audio stream...
                    </Text>
                  )}
                </Flex>
              ) : (
                // Text Input
                <Box style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (currentMessage.trim() && !isSendingMessage) {
                          handleWebRTCTextMessage(currentMessage);
                        }
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
                      e.target.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                    }}
                  />
                  <Button
                    onClick={() => handleWebRTCTextMessage(currentMessage)}
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
                </Box>
              )}
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
                  💡{" "}
                  {chat?.title?.startsWith("Offboarding:")
                    ? "Offboarding Hints"
                    : "Interview Hints"}
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

              {hints ? (
                <Box>
                  <Text
                    size="2"
                    style={{ lineHeight: "1.5", color: "var(--gray-12)" }}
                  >
                    <Markdown>{hints}</Markdown>
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

      {/* ✨ DEBUG: Add WebRTC debug panel for troubleshooting */}
      {false && process.env.NODE_ENV === "development" && (
        <WebRTCDebugPanel audioPlaybackRef={audioPlaybackRef} />
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
            <Text size="2" align="center" style={{ color: "var(--amber-11)" }}>
              Generating feedback...
            </Text>
          </Card>
        </Box>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </Box>
  );
}

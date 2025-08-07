/**
 * ChatArea.tsx
 * Unified text and voice chat interface using WebRTC for audio
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

import { useWebSocket } from "@/contexts/websocket-context";
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
    initializeAudioStream,
    setMicrophoneMuted,
    terminateAudioStream,
    sendWebRTCMessage,
    joinRoom,
    leaveRoom,
    audioPlaybackRef,
  } = useWebSocket();

  // Voice-related state
  const queryClient = useQueryClient();
  const [micActive, setMicActive] = useState(false);

  // Hints-related state
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<string>("");
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState<string>("");

  // 👇 DEPRECATED: The patchCache function is no longer needed.
  // We will handle the logic directly in the send function for more control.

  // Generate hints function
  const generateHints = useCallback(async () => {
    if (!lastAIResponse || !displayMessages.length) return;

    setIsLoadingHints(true);
    try {
      const response = await fetch("/api/chat/hints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: displayMessages,
          chatType: chat?.type || "regular",
          chatTitle: chat?.title || "",
          lastAIResponse: lastAIResponse,
        }),
      });

      const data = await response.json();
      if (data.hints) {
        setHints(data.hints);
      }
    } catch (error) {
      logError("Error generating hints:", error);
    } finally {
      setIsLoadingHints(false);
    }
  }, [lastAIResponse, displayMessages, chat?.type, chat?.title]);

  // Handle hints button click
  const handleHintsClick = useCallback(async () => {
    if (!showHints && !hints && lastAIResponse) {
      await generateHints();
    }
    setShowHints(!showHints);
  }, [showHints, hints, lastAIResponse, generateHints]);

  // Track if we're currently in a room to prevent duplicate joins
  const currentRoomRef = useRef<string | null>(null);

  // Ensure audio element is properly configured for server audio
  useEffect(() => {
    const audio = audioPlaybackRef.current;
    if (audio) {
      // Force unmute and set volume
      audio.muted = false;
      audio.volume = 1;
      logInfo("Audio element configured for server playback", {
        muted: audio.muted,
        volume: audio.volume,
        readyState: audio.readyState,
      });
    }
  }, [audioPlaybackRef]);

  // Join room when chat changes and WebRTC is connected
  useEffect(() => {
    if (chat?.id && isWebRTCConnected && currentRoomRef.current !== chat.id) {
      joinRoom(chat.id);
      currentRoomRef.current = chat.id;
      logInfo(`Joined WebRTC room for chat ${chat.id}`);
    }

    return () => {
      if (chat?.id && currentRoomRef.current === chat.id) {
        leaveRoom(chat.id);
        currentRoomRef.current = null;
        logInfo(`Left WebRTC room for chat ${chat.id}`);
      }
    };
  }, [chat?.id, isWebRTCConnected, joinRoom, leaveRoom]);

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

  // ✨ FIX: Simplify the mode toggle. It no longer needs to set 'isAudioInitialized'.
  const handleModeToggle = useCallback(async () => {
    const nextIsVoiceMode = !isVoiceMode;
    setIsVoiceMode(nextIsVoiceMode);
    setCurrentMessage("");

    if (nextIsVoiceMode) {
      // Just initialize the stream. The user's first press will handle playback.
      if (chat?.id) {
        await initializeAudioStream(chat.id);
      }
    } else {
      // Terminate the stream when leaving voice mode.
      if (chat?.id) {
        terminateAudioStream(chat.id);
        setMicActive(false);
      }
    }
  }, [
    isVoiceMode,
    chat?.id,
    initializeAudioStream,
    terminateAudioStream,
    setCurrentMessage,
  ]);

  // Simple microphone control - only handles local mic, server audio plays continuously
  const handleVoiceStart = useCallback(() => {
    // Only control the local microphone
    setMicrophoneMuted(false);
    setMicActive(true);

    // Force unmute and play server audio on first user interaction
    const audio = audioPlaybackRef.current;
    if (audio) {
      audio.muted = false;
      audio.volume = 1;
      if (audio.paused) {
        audio.play().catch((e) => {
          logError("Failed to start server audio playback", e);
        });
      }
    }

    logInfo("Microphone enabled for voice input");
  }, [setMicrophoneMuted, audioPlaybackRef]);

  const handleVoiceStop = useCallback(() => {
    // This function's only job is to mute the microphone.
    setMicrophoneMuted(true);
    setMicActive(false);
  }, [setMicrophoneMuted]);

  // Handle WebRTC text message sending
  const handleWebRTCTextMessage = useCallback(
    (message: string) => {
      if (!chat?.id || !message.trim()) return;

      // 1. Send the real message to the server
      sendWebRTCMessage(chat.id, message);

      // ✨ 2. FIX: Create a stable base timestamp to prevent re-ordering
      const queryKey = trainingMessageKeys.list(chat.id);
      const baseTimestamp = new Date(); // Create one timestamp
      const tempUserId = `temp-${baseTimestamp.getTime()}`;
      // Ensure the assistant's temp ID is also unique
      const tempAssistantId = `temp-assistant-${baseTimestamp.getTime()}`;

      queryClient.setQueryData<Message[]>(queryKey, (old = []) => [
        ...old,
        // Optimistic User Message
        {
          id: tempUserId,
          role: "user",
          content: message,
          completed: true, // Mark as complete optimistically
          created_at: baseTimestamp.toISOString(), // Use base timestamp
          chat_id: chat.id,
        } as Message,
        // Optimistic Assistant "Thinking" Placeholder
        {
          id: tempAssistantId,
          role: "assistant",
          content: "", // This will be rendered as the "thinking..." message
          completed: false,
          // Use the base timestamp + 1ms to guarantee it's always after
          created_at: new Date(baseTimestamp.getTime() + 1).toISOString(),
          chat_id: chat.id,
        } as Message,
      ]);

      // 3. Clear the input field
      setCurrentMessage("");
    },
    [chat?.id, sendWebRTCMessage, queryClient, setCurrentMessage]
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
      {/* Audio element for continuous server audio playback */}
      <audio
        ref={audioPlaybackRef}
        autoPlay
        playsInline
        muted={false}
        style={{ display: "none" }}
        onLoadedMetadata={() => {
          logInfo("Audio element loaded metadata");
        }}
        onCanPlay={() => {
          logInfo("Audio element can play");
        }}
        onError={(e) => {
          logError("Audio element error", e);
        }}
      />

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
          {displayMessages.map((message) => (
            <Box key={message.id}>
              <Flex
                direction={message.role === "user" ? "row-reverse" : "row"}
                align="start"
                gap="3"
              >
                {/* Avatar */}
                <Card
                  size="1"
                  style={{
                    padding: "8px",
                    background:
                      message.role === "user"
                        ? "var(--blue-3)"
                        : "var(--green-3)",
                    border: `1px solid ${
                      message.role === "user"
                        ? "var(--blue-6)"
                        : "var(--green-6)"
                    }`,
                    opacity: message.completed ? 1 : 0.6,
                  }}
                >
                  {message.role === "user" ? (
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
                      background:
                        message.role === "user"
                          ? "var(--blue-2)"
                          : "var(--gray-2)",
                      border: `1px solid ${
                        message.role === "user"
                          ? "var(--blue-7)"
                          : "var(--gray-7)"
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
                        {message.role === "user"
                          ? ""
                          : chat?.name || "John Doe"}
                      </Text>
                      <Text
                        size="2"
                        style={{ lineHeight: "1.5", color: "var(--gray-12)" }}
                      >
                        <Markdown>
                          {message.role === "assistant" &&
                          !message.completed &&
                          !message.content
                            ? `${chat?.name || "John Doe"} is thinking...`
                            : message.role === "assistant" &&
                              message.completed &&
                              !message.content
                            ? "No response"
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
          ))}

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
                    // ✨ FIX: Simplified disabled logic.
                    // We only need to know if the connection is ready.
                    disabled={!isWebRTCConnected}
                    size="3"
                    style={{
                      padding: "1rem 2rem",
                      borderRadius: "30px",
                      background: micActive
                        ? "linear-gradient(135deg, #ef4444, #dc2626)"
                        : !isWebRTCConnected
                        ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                        : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "white",
                      border: "none",
                      cursor: !isWebRTCConnected ? "not-allowed" : "pointer",
                      fontSize: "1rem",
                      fontWeight: "600",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: micActive
                        ? "0 8px 30px rgba(239, 68, 68, 0.4)"
                        : !isWebRTCConnected
                        ? "0 4px 15px rgba(156, 163, 175, 0.3)"
                        : "0 8px 30px rgba(99, 102, 241, 0.3)",
                      transform: micActive ? "scale(1.05)" : "scale(1)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>
                      {micActive ? "🔴" : !isWebRTCConnected ? "⏳" : "🎤"}
                    </span>
                    {micActive
                      ? "Recording..."
                      : !isWebRTCConnected
                      ? "Connecting..."
                      : "Hold to Speak"}
                  </Button>

                  {/* Connection Status */}
                  {!isWebRTCConnected && (
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
      {process.env.NODE_ENV === "development" && (
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

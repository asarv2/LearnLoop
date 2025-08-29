/**
 * ChatArea.tsx
 * Simplified chat interface with text and voice modes
 *
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

import Markdown from "@/components/common/Markdown";
import { Chat, Message } from "@/types";
import {
  ChatBubbleIcon,
  ChevronUpIcon,
  PaperPlaneIcon,
  PersonIcon,
  SpeakerLoudIcon,
} from "@radix-ui/react-icons";
import { Box, Button, Card, Flex, Text } from "@radix-ui/themes";
import React, { useCallback, useEffect, useRef, useState } from "react";

// Import necessary hooks
import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { useField } from "@/lib/api/hooks/useFields";
import { useParameter } from "@/lib/api/hooks/useParameters";
import { usePersonas, useUserPersona } from "@/lib/api/hooks/usePersonas";
import { trainingMessageKeys } from "@/lib/api/hooks/useTrainingMessages";
import { logError, logInfo } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";

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
  const [isVoiceMode, setIsVoiceMode] = useState(true);

  // WebSocket context
  const {
    isRTCConnected,
    isAudioBridgeReady,
    connectRTC,
    disconnectRTC,
    toggleMic,
    sendWebRTCMessage,
    emitGetHints,
  } = useWebSocket();

  // Voice-related state
  const queryClient = useQueryClient();
  const [micActive, setMicActive] = useState(false);
  const lastFinalizeTimeRef = useRef<number>(0);

  // Hints-related state
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<string>("");
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState<string>("");

  // Custom dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the current user and their associated persona
  const { user } = useAuth();
  const { data: userPersona } = useUserPersona(user?.id);
  const { data: allPersonas } = usePersonas();

  // Get Employee Name from chat parameters
  const firstParamId = chat?.parameter_ids?.[0];
  const { data: firstParam } = useParameter(firstParamId || "", !!firstParamId);
  const { data: firstField } = useField(
    firstParam?.field_id || "",
    !!firstParam?.field_id
  );

  const secondParamId = chat?.parameter_ids?.[1];
  const { data: secondParam } = useParameter(
    secondParamId || "",
    !!secondParamId
  );
  const { data: secondField } = useField(
    secondParam?.field_id || "",
    !!secondParam?.field_id
  );

  const thirdParamId = chat?.parameter_ids?.[2];
  const { data: thirdParam } = useParameter(thirdParamId || "", !!thirdParamId);
  const { data: thirdField } = useField(
    thirdParam?.field_id || "",
    !!thirdParam?.field_id
  );

  // Find which parameter has the "Employee Name" field
  const employeeName =
    firstField?.name === "Employee Name"
      ? firstParam?.value
      : secondField?.name === "Employee Name"
      ? secondParam?.value
      : thirdField?.name === "Employee Name"
      ? thirdParam?.value
      : null;

  // Create a memoized map for efficient persona lookup
  const personaMap = React.useMemo(() => {
    if (!allPersonas) return new Map<string, string>();
    return new Map(allPersonas.map((p) => [p.id, p.name]));
  }, [allPersonas]);

  // Generate hints function using WebSocket
  const generateHints = useCallback(async () => {
    if (!lastAIResponse || !displayMessages.length) return;

    const lastAssistantMessage = displayMessages
      .filter((msg) => msg.role === "assistant")
      .pop();

    if (!lastAssistantMessage?.id) {
      logError("No assistant message found for hints generation");
      return;
    }

    if (chat?.id) {
      emitGetHints({
        chat_id: chat.id,
        message_id: lastAssistantMessage.id,
      });
    }
  }, [lastAIResponse, displayMessages, chat?.id, emitGetHints]);

  // Handle hints button click
  const handleHintsClick = useCallback(async () => {
    if (!showHints && !hints && !isLoadingHints && lastAIResponse) {
      setIsLoadingHints(true);
      await generateHints();
    }
    setShowHints(!showHints);
  }, [showHints, hints, isLoadingHints, lastAIResponse, generateHints]);

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

        if (lastMessage.id && chat?.id) {
          setIsLoadingHints(true);
          emitGetHints({
            chat_id: chat.id,
            message_id: lastMessage.id,
          });
        }
      }
    }
  }, [displayMessages, lastAIResponse, chat?.id, emitGetHints]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Listen for hints generated events
  useEffect(() => {
    const handleHintsGenerated = (event: CustomEvent) => {
      const { hints } = event.detail;
      if (hints && Array.isArray(hints)) {
        setHints(hints.join("\n\n"));
        setIsLoadingHints(false);
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
  }, []);

  // Voice mode toggle
  const handleModeToggle = useCallback(async () => {
    const nextIsVoiceMode = !isVoiceMode;
    setIsVoiceMode(nextIsVoiceMode);
    setCurrentMessage("");

    if (nextIsVoiceMode) {
      // Connect to RTC when switching to voice mode
      if (chat?.id) {
        await connectRTC();
      }
    } else {
      // Disconnect when leaving voice mode
      if (chat?.id) {
        disconnectRTC();
        setMicActive(false);
      }
    }
  }, [isVoiceMode, chat?.id, setCurrentMessage, connectRTC, disconnectRTC]);

  // Voice input handlers
  const handleVoiceStart = useCallback(() => {
    if (showHints) setShowHints(false);
    setMicActive(true);
    toggleMic();
    logInfo("Microphone enabled for voice input.");

    // Create optimistic user message placeholder
    if (chat?.id && userPersona?.id) {
      const queryKey = trainingMessageKeys.list(chat.id);
      const tempId = `temp-voice-${Date.now()}`;

      queryClient.setQueryData<Message[]>(queryKey, (old = []) => [
        ...old,
        {
          id: tempId,
          role: "user",
          persona_id: userPersona.id,
          content: "🎤 Listening...",
          completed: false,
          created_at: new Date().toISOString(),
          chat_id: chat.id,
        } as Message,
      ]);
    }
  }, [
    showHints,
    setShowHints,
    toggleMic,
    chat?.id,
    userPersona?.id,
    queryClient,
  ]);

  const handleVoiceStop = useCallback(() => {
    if (!micActive) return;

    const now = Date.now();
    if (now - lastFinalizeTimeRef.current < 100) return;
    lastFinalizeTimeRef.current = now;

    toggleMic();
    setMicActive(false);
  }, [toggleMic, micActive]);

  // Handle WebRTC text message sending
  const handleWebRTCTextMessage = useCallback(
    (message: string) => {
      if (!chat?.id || !message.trim() || !userPersona?.id) return;

      if (showHints) setShowHints(false);

      sendWebRTCMessage(chat.id, message);

      const queryKey = trainingMessageKeys.list(chat.id);
      const baseTimestamp = new Date();
      const tempUserId = `temp-${baseTimestamp.getTime()}`;

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
      showHints,
      setShowHints,
    ]
  );

  // Persona name lookup
  const getPersonaName = useCallback(
    (personaId: string | null, isAssistantMessage: boolean = false) => {
      if (isAssistantMessage && employeeName) {
        return employeeName;
      }
      if (!personaId) return null;
      return personaMap.get(personaId) || null;
    },
    [personaMap, employeeName]
  );

  // Handle dropdown option selection
  const handleModeSelect = useCallback(
    (mode: "text" | "voice") => {
      const newIsVoiceMode = mode === "voice";
      if (newIsVoiceMode !== isVoiceMode) {
        handleModeToggle();
      }
      setIsDropdownOpen(false);
    },
    [isVoiceMode, handleModeToggle]
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
        height: "100%",
      }}
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
                          {isUserMessage
                            ? "You"
                            : getPersonaName(
                                message.persona_id,
                                isAssistantMessage
                              ) || "Assistant"}
                        </Text>
                        <Text
                          size="2"
                          style={{ lineHeight: "1.5", color: "var(--gray-12)" }}
                        >
                          <Markdown>
                            {!message.completed &&
                            !message.content &&
                            isAssistantMessage
                              ? `${
                                  getPersonaName(
                                    message.persona_id,
                                    isAssistantMessage
                                  ) || "Assistant"
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
              {/* Input Mode Selection and Interface */}
              <Flex gap="3" align="center">
                {/* Custom Mode Dropdown */}
                <Box style={{ position: "relative" }} ref={dropdownRef}>
                  <Button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    variant="outline"
                    size="2"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "1px solid var(--gray-6)",
                      fontSize: "14px",
                      fontWeight: "500",
                      background: "white",
                      color: "var(--gray-12)",
                      cursor: "pointer",
                      outline: "none",
                      minWidth: "100px",
                      height: "48px",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span>{isVoiceMode ? "Voice" : "Text"}</span>
                    <ChevronUpIcon
                      width="16"
                      height="16"
                      style={{
                        transform: isDropdownOpen
                          ? "rotate(0deg)"
                          : "rotate(180deg)",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </Button>

                  {/* Dropdown Options */}
                  {isDropdownOpen && (
                    <Box
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: "0",
                        right: "0",
                        marginBottom: "4px",
                        background: "white",
                        border: "1px solid var(--gray-6)",
                        borderRadius: "12px",
                        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.12)",
                        zIndex: 1000,
                        overflow: "hidden",
                      }}
                    >
                      <Button
                        onClick={() => handleModeSelect("text")}
                        variant="ghost"
                        size="1"
                        style={{
                          width: "100%",
                          justifyContent: "flex-start",
                          padding: "12px 16px",
                          borderRadius: "0",
                          background: "transparent",
                          color: !isVoiceMode
                            ? "var(--blue-11)"
                            : "var(--gray-12)",
                          fontWeight: !isVoiceMode ? "600" : "500",
                          fontSize: "14px",
                          border: "none",
                        }}
                      >
                        Text
                      </Button>

                      {/* Divider Line */}
                      <Box
                        style={{
                          width: "100%",
                          height: "1px",
                          background: "var(--gray-4)",
                          margin: "0",
                        }}
                      />

                      <Button
                        onClick={() => handleModeSelect("voice")}
                        variant="ghost"
                        size="1"
                        style={{
                          width: "100%",
                          justifyContent: "flex-start",
                          padding: "12px 16px",
                          borderRadius: "0",
                          background: "transparent",
                          color: isVoiceMode
                            ? "var(--green-11)"
                            : "var(--gray-12)",
                          fontWeight: isVoiceMode ? "600" : "500",
                          fontSize: "14px",
                          border: "none",
                          borderBottom: "1px solid var(--gray-4)",
                        }}
                      >
                        Voice
                      </Button>
                    </Box>
                  )}
                </Box>

                {/* Input Interface */}
                <Box style={{ flex: 1 }}>
                  {isVoiceMode ? (
                    // Voice Input
                    <Flex direction="column" gap="3" align="center">
                      {/* Voice Button */}
                      <Flex
                        gap="3"
                        align="center"
                        justify="center"
                        style={{ width: "100%" }}
                      >
                        <Button
                          onMouseDown={handleVoiceStart}
                          onMouseUp={handleVoiceStop}
                          onMouseLeave={handleVoiceStop}
                          onTouchStart={handleVoiceStart}
                          onTouchEnd={handleVoiceStop}
                          disabled={!isRTCConnected || !isAudioBridgeReady}
                          size="3"
                          style={{
                            padding: "12px 16px",
                            height: "48px",
                            borderRadius: "12px",
                            background: micActive
                              ? "#ef4444"
                              : !isRTCConnected || !isAudioBridgeReady
                              ? "#9ca3af"
                              : "white",
                            color: micActive
                              ? "white"
                              : !isRTCConnected || !isAudioBridgeReady
                              ? "white"
                              : "var(--gray-12)",
                            border: micActive
                              ? "none"
                              : "1px solid var(--gray-6)",
                            cursor:
                              !isRTCConnected || !isAudioBridgeReady
                                ? "not-allowed"
                                : "pointer",
                            fontSize: "14px",
                            fontWeight: "500",
                            transition: "all 0.2s ease",
                            boxShadow: micActive
                              ? "0 8px 30px rgba(239, 68, 68, 0.4)"
                              : "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transform: micActive ? "scale(1.05)" : "scale(1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {micActive ? (
                            <Box
                              style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                background: "#ef4444",
                                animation: "pulse 1.5s ease-in-out infinite",
                              }}
                            />
                          ) : !isRTCConnected || !isAudioBridgeReady ? (
                            <Box
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                background: "#9ca3af",
                              }}
                            />
                          ) : (
                            <SpeakerLoudIcon width="16" height="16" />
                          )}
                          {micActive
                            ? "Listening..."
                            : !isRTCConnected || !isAudioBridgeReady
                            ? "Connecting..."
                            : "Hold to Speak"}
                        </Button>

                        {/* Hints Button for Voice Mode */}
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
                              cursor: isLoadingHints
                                ? "not-allowed"
                                : "pointer",
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

                      {(!isRTCConnected || !isAudioBridgeReady) && (
                        <Text size="2" style={{ color: "var(--amber-11)" }}>
                          Connecting to audio stream...
                        </Text>
                      )}
                    </Flex>
                  ) : (
                    // Text Input
                    <Flex align="center" gap="3">
                      <Box style={{ position: "relative", flex: 1 }}>
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
                            e.target.style.boxShadow =
                              "0 1px 3px rgba(0, 0, 0, 0.1)";
                          }}
                        />
                        <Button
                          onClick={() =>
                            handleWebRTCTextMessage(currentMessage)
                          }
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
                  )}
                </Box>
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

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
import { Box, Button, Card, Flex, Text } from "@radix-ui/themes";
import React, { useCallback, useEffect, useState } from "react";

// Import necessary hooks
import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { useField } from "@/lib/api/hooks/useFields";
import { useParameter } from "@/lib/api/hooks/useParameters";
import { usePersonas, useUserPersona } from "@/lib/api/hooks/usePersonas";
import { logError } from "@/utils/logger";

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
    isAudioBridgeReady,
    micOn,
    connectRTC,
    toggleMic,
    sendWebRTCMessage,
    emitGetHints,
  } = useWebSocket();

  // Hints-related state
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<string>("");
  const [isLoadingHints, setIsLoadingHints] = useState(false);
  const [lastAIResponse, setLastAIResponse] = useState<string>("");

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

  // Connect handler
  const onConnect = useCallback(() => {
    if (!chat?.id) return;
    connectRTC(chat.id);
  }, [chat?.id, connectRTC]);

  // Toggle mic handler
  const onToggleMic = useCallback(() => {
    if (!isRTCConnected) return;
    toggleMic();
  }, [isRTCConnected, toggleMic]);

  // Send message handler
  const onSend = useCallback(() => {
    const message = currentMessage.trim();
    if (!message || !chat?.id || !isRTCConnected) return;

    // No optimistic message
    sendWebRTCMessage(chat.id, message);
    setCurrentMessage("");
  }, [
    chat?.id,
    currentMessage,
    isRTCConnected,
    sendWebRTCMessage,
    setCurrentMessage,
  ]);

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
              {/* Connect and Mic Controls */}
              <Flex gap="3" align="center">
                <Button
                  onClick={onConnect}
                  disabled={isRTCConnected}
                  size="2"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "500",
                    background: isRTCConnected ? "var(--green-3)" : "white",
                    color: isRTCConnected
                      ? "var(--green-11)"
                      : "var(--gray-12)",
                    border: "1px solid var(--gray-6)",
                    cursor: isRTCConnected ? "default" : "pointer",
                    outline: "none",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                    transition: "all 0.2s ease",
                    height: "48px",
                    flexShrink: 0,
                  }}
                >
                  {isRTCConnected ? "Connected" : "Connect"}
                </Button>

                <Button
                  onClick={onToggleMic}
                  disabled={!isRTCConnected || !isAudioBridgeReady}
                  size="2"
                  title={micOn ? "Mute mic" : "Unmute mic"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "500",
                    background: micOn ? "#ef4444" : "white",
                    color: micOn ? "white" : "var(--gray-12)",
                    border: "1px solid var(--gray-6)",
                    cursor:
                      !isRTCConnected || !isAudioBridgeReady
                        ? "not-allowed"
                        : "pointer",
                    outline: "none",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                    transition: "all 0.2s ease",
                    height: "48px",
                    flexShrink: 0,
                  }}
                >
                  {micOn ? "🎙️ Mute" : "🔇 Unmute"}
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

              {/* Text Input */}
              <Flex align="center" gap="3" style={{ marginTop: 12 }}>
                <Box style={{ position: "relative", flex: 1 }}>
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
                    disabled={!isRTCConnected || isSendingMessage}
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
                      opacity: !isRTCConnected ? 0.6 : 1,
                    }}
                    onFocus={(e) => {
                      if (isRTCConnected) {
                        e.target.style.borderColor = "var(--blue-7)";
                        e.target.style.boxShadow =
                          "0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(59, 130, 246, 0.1)";
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--gray-6)";
                      e.target.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                    }}
                  />
                  <Button
                    onClick={onSend}
                    disabled={
                      !isRTCConnected ||
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
                        isRTCConnected &&
                        currentMessage.trim() &&
                        !isSendingMessage
                          ? "var(--blue-9)"
                          : "var(--gray-6)",
                      border: "none",
                      width: "36px",
                      height: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor:
                        isRTCConnected &&
                        currentMessage.trim() &&
                        !isSendingMessage
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    <PaperPlaneIcon width="16" height="16" />
                  </Button>
                </Box>
              </Flex>

              {(!isRTCConnected || !isAudioBridgeReady) && (
                <Text size="2" style={{ color: "var(--amber-11)" }}>
                  {!isRTCConnected
                    ? "Click Connect to start"
                    : "Connecting to audio stream..."}
                </Text>
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
    </Box>
  );
}

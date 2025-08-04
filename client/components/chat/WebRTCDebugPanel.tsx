"use client";

import { useWebSocket } from "@/contexts/websocket-context";
import { Box, Button, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";

interface WebRTCDebugPanelProps {
  className?: string;
}

export default function WebRTCDebugPanel({
  className = "",
}: WebRTCDebugPanelProps) {
  const { isConnected, isWebRTCConnected } = useWebSocket();

  const [isVisible, setIsVisible] = useState(false);

  if (!isVisible) {
    return (
      <Button
        variant="ghost"
        size="1"
        onClick={() => setIsVisible(true)}
        style={{
          position: "fixed",
          bottom: "10px",
          right: "10px",
          zIndex: 1000,
        }}
      >
        🐛 Debug
      </Button>
    );
  }

  return (
    <Box
      style={{
        position: "fixed",
        bottom: "10px",
        right: "10px",
        background: "white",
        border: "1px solid var(--gray-6)",
        borderRadius: "8px",
        padding: "12px",
        zIndex: 1000,
        maxWidth: "300px",
        fontSize: "12px",
      }}
      className={className}
    >
      <Flex direction="column" gap="2">
        <Flex align="center" justify="between">
          <Text size="2" weight="medium">
            WebRTC Debug
          </Text>
          <Button variant="ghost" size="1" onClick={() => setIsVisible(false)}>
            ✕
          </Button>
        </Flex>
        <Box
          style={{
            background: "var(--gray-2)",
            padding: "8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          <Text size="1" color="gray">
            WebRTC State: {isWebRTCConnected ? "Connected" : "Disconnected"}
          </Text>
          <Text size="1" color="gray">
            WebSocket State: {isConnected ? "Connected" : "Disconnected"}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

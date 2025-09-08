/**
 * IntroMessageModal.tsx
 * Modal for selecting intro message to start conversation
 * @siladie
 * 01-28-2025
 */
"use client";

import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";

interface IntroMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMessage: (message: string) => void;
}

const INTRO_MESSAGES = [
  "Hey, how's your day been?",
  "Hi! How are you doing?",
  "Hey, how's everything going?",
];

export default function IntroMessageModal({
  isOpen,
  onClose,
  onSelectMessage,
}: IntroMessageModalProps) {
  const handleSelectMessage = (message: string) => {
    console.log("Intro message selected:", message);
    onSelectMessage(message);
    // Don't call onClose() here - let the parent component handle closing
  };

  if (!isOpen) return null;

  return (
    <Box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <Box
        style={{
          width: "520px",
          maxWidth: "90vw",
          padding: "28px",
          background: "white",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.2)",
          borderRadius: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box mb="6">
          <Heading
            size="6"
            weight="bold"
            mb="3"
            style={{ textAlign: "center" }}
          >
            Start the Conversation
          </Heading>
        </Box>

        <Flex direction="column" gap="3" mb="6">
          {INTRO_MESSAGES.map((message, index) => (
            <Button
              key={index}
              variant="outline"
              size="4"
              onClick={() => handleSelectMessage(message)}
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
              <Text size="4" weight="medium" style={{ lineHeight: "1.4" }}>
                {message}
              </Text>
            </Button>
          ))}
        </Flex>
      </Box>
    </Box>
  );
}

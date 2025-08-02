/**
 * InterviewSimulation.tsx
 * @AshokSaravanan222 & @siladiea
 * 07/09/2025
 */

"use client";

import { useAttempt } from "@/lib/api/hooks/useAttempts";
import { useChat } from "@/lib/api/hooks/useChats";
import { useTraining } from "@/lib/api/hooks/useTrainings";
import { Assessment } from "@/types";
import { logError } from "@/utils/logger";
import { Box } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AssessmentWizard from "./AssessmentWizard";
import ChatArea from "./ChatArea";
import ChatHeader from "./ChatHeader";
import FeedbackModal from "./FeedbackModal";

interface TrainingAttemptProps {
  trainingId: string;
  attemptId: string;
}

interface StreamingMessage {
  id: string;
  content: string;
  completed: boolean;
}

export default function TrainingAttempt({
  trainingId,
  attemptId,
}: TrainingAttemptProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentMessage, setCurrentMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false);
  const [streamingMessage, setStreamingMessage] =
    useState<StreamingMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: training } = useTraining(trainingId, [
    "scenarios",
    "rubrics",
    "standards",
  ]);
  const { data: attempt } = useAttempt(attemptId);
  const { data: chat } = useChat(attempt?.chat_id!, [
    "grades",
    "assessment",
    "feedback",
    "hints",
    "messages",
  ]);

  // Determine if interview is active based on chat completion status
  const isInterviewActive = chat ? !chat.completed : true;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || isSendingMessage || !isInterviewActive)
      return;

    const userMessage = currentMessage;
    setCurrentMessage("");
    setIsSendingMessage(true);
    setStreamingMessage(null);

    try {
      const formData = new FormData();
      formData.append("chatId", chatId);
      formData.append("message", userMessage);

      const response = await fetch("/api/chat/message", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case "user_message_created":
                  // Immediately add the user message to the query cache
                  queryClient.setQueryData(
                    ["messages", chatId],
                    (oldMessages: typeof messages) => {
                      if (!oldMessages) return [data.message];
                      // Check if message already exists to avoid duplicates
                      const exists = oldMessages.some(
                        (msg) => msg.id === data.message.id
                      );
                      if (exists) return oldMessages;
                      return [...oldMessages, data.message];
                    }
                  );
                  break;

                case "assistant_message_created":
                  setStreamingMessage({
                    id: data.messageId,
                    content: "",
                    completed: false,
                  });
                  break;

                case "content_delta":
                  setStreamingMessage((prev) =>
                    prev
                      ? {
                          ...prev,
                          content: data.content,
                        }
                      : null
                  );
                  break;

                case "message_completed":
                  setStreamingMessage((prev) =>
                    prev
                      ? {
                          ...prev,
                          content: data.content,
                          completed: true,
                        }
                      : null
                  );

                  // Invalidate messages query to refetch updated data
                  await queryClient.invalidateQueries({
                    queryKey: ["messages", chatId],
                  });

                  // Clear streaming message after a brief delay
                  setTimeout(() => {
                    setStreamingMessage(null);
                  }, 100);
                  break;

                case "error":
                  logError("Streaming error:", data.error);
                  setStreamingMessage(null);

                  // Invalidate messages query to refetch updated data
                  await queryClient.invalidateQueries({
                    queryKey: ["messages", chatId],
                  });
                  break;
              }
            } catch (parseError) {
              logError("Error parsing SSE data:", parseError);
            }
          }
        }
      }
    } catch (error) {
      logError("Error sending message:", error);
      setStreamingMessage(null);

      // Invalidate messages query to ensure we have the latest data
      await queryClient.invalidateQueries({
        queryKey: ["messages", chatId],
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const endInterview = async () => {
    if (isEndingInterview) return;

    setIsEndingInterview(true);

    try {
      const formData = new FormData();
      formData.append("chatId", chatId);

      const response = await fetch("/api/chat/end", {
        method: "POST",
        body: formData,
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        logError("Server error response:", errorText);
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        logError("Error parsing JSON response:", parseError);
        throw new Error("Invalid response format from server");
      }

      if (data.success) {
        // Invalidate chat and feedback queries to get the updated data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["chat", chatId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["feedback", chatId],
          }),
        ]);

        // Show the assessment wizard
        setShowAssessment(true);
      } else {
        logError("Failed to end interview:", data);
        throw new Error(data.error || "Failed to end interview");
      }
    } catch (error) {
      logError("Error ending interview:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to end interview: ${errorMessage}. Please check the console for more details.`
      );
    } finally {
      setIsEndingInterview(false);
    }
  };

  const handleAssessmentComplete = async (
    responses: Assessment["responses"]
  ) => {
    setIsSubmittingAssessment(true);

    try {
      const response = await fetch("/api/chat/assessment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          responses,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Invalidate chat, feedback, and score queries to get the updated data
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["chat", chatId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["feedback", chatId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["score", chatId],
          }),
        ]);
        setShowAssessment(false);
        setShowFeedback(true);
      } else {
        logError("Assessment processing failed:", data);
        throw new Error(data.error || "Failed to process assessment");
      }
    } catch (error) {
      logError("Error processing assessment:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      alert(
        `Failed to process assessment: ${errorMessage}. Please check the console for more details.`
      );
    } finally {
      setIsSubmittingAssessment(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Combine regular messages with streaming message for display
  const displayMessages = [...messages];
  if (streamingMessage) {
    displayMessages.push({
      id: streamingMessage.id,
      content: streamingMessage.content,
      role: "assistant" as const,
      chat_id: chatId,
      completed: streamingMessage.completed,
      completed_at: "",
      created_at: new Date().toISOString(),
      training_id: chat?.training_id || null,
      error: null,
      persona_id: null,
    });
  }

  return (
    <Box style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <ChatHeader
        candidateName={chat?.name || "John Doe"}
        interviewType={chat?.type || ""}
        resumeId={chat?.resume_id || ""}
        onEndInterview={endInterview}
        isInterviewActive={isInterviewActive}
        isEndingInterview={isEndingInterview}
        onShowFeedback={() => setShowFeedback(true)}
        onBack={() => router.push("/dashboard/trainings")}
        interviewStartTimeIso={chat?.created_at}
        completedAtIso={chat?.completed_at}
      />

      <ChatArea
        displayMessages={displayMessages}
        isSendingMessage={isSendingMessage}
        isEndingInterview={isEndingInterview}
        streamingMessage={!!streamingMessage}
        isInterviewActive={isInterviewActive}
        currentMessage={currentMessage}
        setCurrentMessage={setCurrentMessage}
        handleKeyPress={handleKeyPress}
        sendMessage={sendMessage}
        chat={chat!}
        messagesEndRef={messagesEndRef}
      />

      {/* Assessment Wizard */}
      <AssessmentWizard
        isOpen={showAssessment}
        onClose={() => setShowAssessment(false)}
        onComplete={handleAssessmentComplete}
        candidateName={chat?.name || "John Doe"}
        isSubmitting={isSubmittingAssessment}
        messages={messages}
        chat={chat!}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        feedback={feedback?.[0] || null}
        candidateName={chat?.name || "John Doe"}
        interviewScore={interviewScore}
        chat={chat}
      />
    </Box>
  );
}

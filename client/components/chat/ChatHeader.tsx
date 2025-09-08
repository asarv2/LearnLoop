"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeftIcon, Cross2Icon, FileTextIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Box, Button, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";

interface InterviewHeaderProps {
  isEndingInterview: boolean;
  onEndInterview: () => void;
  isInterviewActive: boolean;
  onShowFeedback?: () => void;
  onShowAssessment?: () => void;
  onBack?: () => void;
  interviewStartTimeIso?: string;
  completedAtIso?: string | null;
  isAudioMode?: boolean;
  onToggleAudioMode?: () => void;
  scenario?: {
    title: string;
    problem_statement: string | null;
    objectives: string[];
  } | null;
  hasAssessment?: boolean;
  hasFeedback?: boolean;
  documentId?: string;
  documentFieldName?: string;
}

export default function ChatHeader({
  isEndingInterview,
  onEndInterview,
  isInterviewActive,
  onShowFeedback,
  onShowAssessment,
  onBack,
  interviewStartTimeIso,
  completedAtIso,
  isAudioMode = false,
  onToggleAudioMode,
  scenario,
  hasAssessment = false,
  hasFeedback = false,
  documentId,
  documentFieldName,
}: InterviewHeaderProps) {
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Memoize Date objects for timer
  const interviewStartTime = useMemo(
    () => (interviewStartTimeIso ? new Date(interviewStartTimeIso) : undefined),
    [interviewStartTimeIso]
  );
  const completedAt = useMemo(
    () => (completedAtIso ? new Date(completedAtIso) : undefined),
    [completedAtIso]
  );

  // Timer effect for active interviews
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (interviewStartTime) {
      if (isInterviewActive && !completedAt) {
        // Active interview - count up
        const startTime = interviewStartTime;

        // Function to calculate and update elapsed time
        const updateElapsedTime = () => {
          const now = new Date();
          const diffInSeconds = Math.floor(
            (now.getTime() - startTime.getTime()) / 1000
          );
          const elapsed = Math.max(0, diffInSeconds);
          setElapsedTime(elapsed);
        };

        // Set initial time immediately
        updateElapsedTime();

        // Update every second
        interval = setInterval(updateElapsedTime, 1000);
      } else if (completedAt) {
        // Interview is completed - show final duration
        const startTime = interviewStartTime;
        const endTime = completedAt;
        const diffInSeconds = Math.floor(
          (endTime.getTime() - startTime.getTime()) / 1000
        );
        const elapsed = Math.max(0, diffInSeconds);
        setElapsedTime(elapsed);
      }
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [
    isInterviewActive,
    interviewStartTime,
    completedAt,
    elapsedTime,
    interviewStartTimeIso,
  ]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // End button text
  const endButtonText = "End Training";

  return (
    <>
      <Box
        style={{
          background: "transparent",
          borderBottom: "1px solid var(--gray-6)",
          padding: "16px 24px",
          width: "100%",
        }}
      >
        <Flex direction="column" gap="3">
          {/* First Row - Back button on left, Title centered, Controls on right */}
          <Flex align="center" justify="between">
            {/* Left side - Back button */}
            <Flex align="center" gap="4" style={{ minWidth: "120px" }}>
              {onBack && (
                <Button variant="ghost" size="2" onClick={onBack}>
                  <ArrowLeftIcon />
                  Back
                </Button>
              )}
            </Flex>

            {/* Center - Title */}
            <Flex align="center" justify="center" style={{ flex: 1 }}>
              <Heading size="5" weight="bold" color="blue">
                {scenario?.title || "Training"}
              </Heading>
            </Flex>

            {/* Right side - Controls */}
            <Flex
              align="center"
              gap="3"
              pr="3"
              style={{ minWidth: "120px", justifyContent: "flex-end" }}
            >
              {isInterviewActive ? (
                <Text size="2" weight="medium" color="gray">
                  {formatTime(elapsedTime)}
                </Text>
              ) : (
                <>
                  <Text size="2" weight="medium" color="gray">
                    Duration: {formatTime(elapsedTime)}
                  </Text>
                  {hasAssessment && !hasFeedback && onShowAssessment && (
                    <Button
                      onClick={onShowAssessment}
                      variant="outline"
                      size="2"
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
                        cursor: "pointer",
                        outline: "none",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        height: "48px",
                        flexShrink: 0,
                      }}
                    >
                      Assessment
                    </Button>
                  )}
                  {hasFeedback && onShowFeedback && (
                    <Button
                      onClick={onShowFeedback}
                      variant="outline"
                      size="2"
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
                        cursor: "pointer",
                        outline: "none",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        height: "48px",
                        flexShrink: 0,
                      }}
                    >
                      Feedback
                    </Button>
                  )}
                </>
              )}

              {/* Audio Mode Toggle - only show for active interviews */}
              {isInterviewActive && onToggleAudioMode && (
                <Button
                  variant={isAudioMode ? "solid" : "soft"}
                  color={isAudioMode ? "purple" : "gray"}
                  size="2"
                  onClick={onToggleAudioMode}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                    <path d="M12 18v4" />
                    <path d="M8 22h8" />
                  </svg>
                  {isAudioMode ? "Audio" : "Audio"}
                </Button>
              )}

              {/* Document Viewer Button - show whenever a document is present */}
              {documentId && (
                <>
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <Button
                          variant="soft"
                          size="2"
                          radius="full"
                          onClick={() => setIsDocumentModalOpen(true)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "12px",
                            flexShrink: 0,
                          }}
                          aria-label={
                            documentFieldName
                              ? `Show ${documentFieldName}`
                              : "Show document"
                          }
                        >
                          <FileTextIcon width="18" height="18" />
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
                          {documentFieldName
                            ? `Show ${documentFieldName}`
                            : "Show document"}
                          <Tooltip.Arrow style={{ fill: "var(--gray-12)" }} />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>

                  <Dialog.Root
                    open={isDocumentModalOpen}
                    onOpenChange={setIsDocumentModalOpen}
                  >
                    <Dialog.Portal>
                      <Dialog.Overlay
                        style={{
                          position: "fixed",
                          inset: 0,
                          backgroundColor: "rgba(0, 0, 0, 0.5)",
                          animation: "fadeIn 0.2s ease-out",
                        }}
                      />
                      <Dialog.Content
                        style={{
                          position: "fixed",
                          top: "50%",
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          backgroundColor: "white",
                          borderRadius: "8px",
                          padding: "24px",
                          width: "90vw",
                          maxWidth: "1000px",
                          height: "85vh",
                          overflow: "hidden",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                          border: "1px solid var(--gray-6)",
                        }}
                      >
                        <Flex
                          direction="column"
                          gap="4"
                          style={{ height: "100%" }}
                        >
                          <Flex align="center" justify="between">
                            <Dialog.Title asChild>
                              <Heading
                                size="5"
                                weight="bold"
                                style={{ color: "var(--gray-12)" }}
                              >
                                {documentFieldName || "Document"} -{" "}
                                {scenario?.title || "Training"}
                              </Heading>
                            </Dialog.Title>
                            <Dialog.Close asChild>
                              <Button
                                variant="ghost"
                                size="2"
                                style={{
                                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                                  color: "#ef4444",
                                  border: "1px solid rgba(239, 68, 68, 0.2)",
                                  borderRadius: "6px",
                                }}
                              >
                                <Cross2Icon width="16" height="16" />
                              </Button>
                            </Dialog.Close>
                          </Flex>
                          <Separator size="4" />
                          <Box
                            style={{
                              flex: 1,
                              border: "1px solid var(--gray-7)",
                              borderRadius: "6px",
                              overflow: "hidden",
                            }}
                          >
                            <iframe
                              src={`/api/v1/documents/${documentId}/file`}
                              style={{
                                width: "100%",
                                height: "100%",
                                border: "none",
                              }}
                              title={`${documentFieldName || "Document"} - ${
                                scenario?.title || "Training"
                              }`}
                            />
                          </Box>
                        </Flex>
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                </>
              )}

              {/* Resume Button - only for interview training and if resumeId exists */}
              {false && (
                <Dialog.Root
                  open={isResumeModalOpen}
                  onOpenChange={setIsResumeModalOpen}
                >
                  <Dialog.Trigger asChild>
                    <Button variant="soft" size="2">
                      <FileTextIcon />
                      View Resume
                    </Button>
                  </Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Overlay
                      style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        animation: "fadeIn 0.2s ease-out",
                      }}
                    />
                    <Dialog.Content
                      style={{
                        position: "fixed",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        backgroundColor: "white",
                        borderRadius: "8px",
                        padding: "24px",
                        width: "90vw",
                        maxWidth: "900px",
                        height: "85vh",
                        overflow: "hidden",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
                        border: "1px solid var(--gray-6)",
                      }}
                    >
                      <Flex
                        direction="column"
                        gap="4"
                        style={{ height: "100%" }}
                      >
                        <Flex align="center" justify="between">
                          <Dialog.Title asChild>
                            <Heading
                              size="5"
                              weight="bold"
                              style={{ color: "var(--gray-12)" }}
                            >
                              Document - {scenario?.title || "Training"}
                            </Heading>
                          </Dialog.Title>
                          <Dialog.Close asChild>
                            <Button
                              variant="ghost"
                              size="2"
                              style={{
                                backgroundColor: "rgba(239, 68, 68, 0.1)",
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                borderRadius: "6px",
                              }}
                            >
                              <Cross2Icon width="16" height="16" />
                            </Button>
                          </Dialog.Close>
                        </Flex>
                        <Separator size="4" />
                        <Box
                          style={{
                            flex: 1,
                            border: "1px solid var(--gray-7)",
                            borderRadius: "6px",
                            overflow: "hidden",
                          }}
                        >
                          {false ? (
                            <iframe
                              src={`/api/resume/`}
                              style={{
                                width: "100%",
                                height: "100%",
                                border: "none",
                              }}
                              title={`Document - ${
                                scenario?.title || "Training"
                              }`}
                            />
                          ) : (
                            <Flex
                              align="center"
                              justify="center"
                              style={{
                                height: "100%",
                                color: "var(--gray-10)",
                              }}
                            >
                              <Text size="3">No resume file available</Text>
                            </Flex>
                          )}
                        </Box>
                      </Flex>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              )}

              {/* End Interview/Training Button - only show for active trainings */}
              {isInterviewActive && (
                <Button
                  variant="solid"
                  color="red"
                  size="2"
                  onClick={onEndInterview}
                  loading={isEndingInterview}
                  disabled={isEndingInterview}
                >
                  {isEndingInterview
                    ? endButtonText.replace("End", "Ending...")
                    : endButtonText}
                </Button>
              )}
            </Flex>
          </Flex>

          {/* Second Row - Problem Statement and Objectives */}
          {(scenario?.problem_statement ||
            (scenario?.objectives && scenario.objectives.length > 0)) && (
            <Flex
              direction="row"
              gap="4"
              style={{
                alignItems: "flex-start",
              }}
            >
              {/* Problem Statement - Left */}
              {scenario?.problem_statement && (
                <Box style={{ flex: 1 }}>
                  <Text
                    size="2"
                    style={{
                      color: "var(--gray-11)",
                      lineHeight: "1.4",
                    }}
                  >
                    {scenario.problem_statement}
                  </Text>
                </Box>
              )}

              {/* Divider */}
              {scenario?.problem_statement &&
                scenario?.objectives &&
                scenario.objectives.length > 0 && (
                  <Box
                    style={{
                      width: "1px",
                      height: "60px",
                      background: "var(--gray-6)",
                      margin: "0 8px",
                      flexShrink: 0,
                    }}
                  />
                )}

              {/* Objectives - Right */}
              {scenario?.objectives && scenario.objectives.length > 0 && (
                <Box style={{ flex: 1 }}>
                  <Box>
                    {scenario.objectives.map((objective, index) => (
                      <Flex
                        key={index}
                        align="start"
                        gap="2"
                        style={{ marginBottom: "6px" }}
                      >
                        <Box
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "var(--blue-9)",
                            marginTop: "6px",
                            flexShrink: 0,
                          }}
                        />
                        <Text
                          size="2"
                          style={{
                            color: "var(--gray-11)",
                            lineHeight: "1.4",
                          }}
                        >
                          {objective}
                        </Text>
                      </Flex>
                    ))}
                  </Box>
                </Box>
              )}
            </Flex>
          )}
        </Flex>
      </Box>
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

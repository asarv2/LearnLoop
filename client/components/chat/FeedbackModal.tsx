"use client";

import { useRubrics } from "@/lib/api/hooks/useRubrics";
import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import type { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import type { Chat, RubricGrade, StandardGrade } from "@/types";
import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDownIcon, Cross2Icon } from "@radix-ui/react-icons";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";

const TEXT_COLOR = "#000000"; // Black text for all content

// Simple Score Display Component
const ScoreDisplay = ({
  score,
  maxScore = 5,
}: {
  score: number;
  maxScore?: number;
}) => {
  const getScoreColorHex = (score: number, maxScore: number) => {
    // Convert to percentage for color mapping
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "#16a34a"; // Green (80%+)
    if (percentage >= 60) return "#eab308"; // Yellow (60-79%)
    if (percentage >= 40) return "#f97316"; // Orange (40-59%)
    return "#dc2626"; // Red (below 40%)
  };

  return (
    <Text
      size="3"
      weight="bold"
      style={{
        color: getScoreColorHex(score, maxScore),
      }}
    >
      {Math.round(score)}/{maxScore}
    </Text>
  );
};

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  score?: number | null;
  chat?: Chat | null;
  gradingProgress?: {
    isGrading: boolean;
    currentStep: string;
    completedSteps: string[];
    progress: {
      rubric_name?: string;
      standards_count?: number;
      total_tools?: number;
      standards_graded?: number;
      strengths_count?: number;
      improvements_count?: number;
    };
    latestUpdate?: {
      type: string;
      message: string;
      standard_name?: string;
      score?: number;
      feedback_preview?: string;
    };
  };
}

export default function FeedbackModal({
  isOpen,
  onClose,
  score,
  chat,
  gradingProgress,
}: FeedbackModalProps) {
  const { data: scenarios } = useScenariosByTrainingId(chat?.training_id || "");
  const { data: rubrics } = useRubrics(null);

  const cleanText = (text: string) => {
    // Remove markdown bold formatting (**text**)
    return text.replace(/\*\*(.*?)\*\*/g, "$1");
  };

  const getScoreColorHex = (score: number, maxScore: number = 5) => {
    // Convert to percentage for color mapping
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return "#16a34a"; // Green (80%+)
    if (percentage >= 60) return "#eab308"; // Yellow (60-79%)
    if (percentage >= 40) return "#f97316"; // Orange (40-59%)
    return "#dc2626"; // Red (below 40%)
  };

  // Extract rubric and standard grades if present on chat include
  const chatWithIncludes = chat as unknown as ChatWithAllIncludes | undefined;
  const rubric_id = scenarios?.[0]?.rubric_id;
  const rubric = rubrics?.find((r) => r.id === rubric_id);
  const rubricGrades: RubricGrade[] =
    (chatWithIncludes?.rubric_grades as unknown as RubricGrade[]) || [];
  // Use the rubric grade with the highest score (most recent/complete grading)
  const bestRubricGrade = rubricGrades.reduce(
    (best, current) => (current.score > best.score ? current : best),
    rubricGrades[0] || { score: 0 }
  );
  const standardGrades: StandardGrade[] =
    (bestRubricGrade &&
      (bestRubricGrade as unknown as { standard_grades?: StandardGrade[] })
        .standard_grades) ||
    [];

  // Show grading progress if currently grading
  if (gradingProgress?.isGrading) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
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
              padding: "32px",
              width: "90vw",
              maxWidth: "600px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--gray-6)",
            }}
          >
            <Flex
              direction="column"
              gap="6"
              align="center"
              style={{ textAlign: "center" }}
            >
              <Dialog.Title asChild>
                <Heading size="5" weight="medium" style={{ color: "#000000" }}>
                  Grading in Progress
                </Heading>
              </Dialog.Title>

              {/* Progress indicator */}
              <Box
                style={{
                  width: "100%",
                  backgroundColor: "var(--gray-2)",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "16px",
                }}
              >
                <Text
                  size="3"
                  style={{ color: "#000000", marginBottom: "12px" }}
                >
                  {gradingProgress.currentStep}
                </Text>

                {/* Progress bar */}
                <Box
                  style={{
                    width: "100%",
                    height: "8px",
                    backgroundColor: "var(--gray-4)",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      height: "100%",
                      backgroundColor: "#3b82f6",
                      width: `${Math.min(
                        100,
                        (gradingProgress.completedSteps.length /
                          (gradingProgress.progress.total_tools || 1)) *
                          100
                      )}%`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </Box>

                <Text size="2" style={{ color: "#64748b", marginTop: "8px" }}>
                  {gradingProgress.completedSteps.length} of{" "}
                  {gradingProgress.progress.total_tools || 0} steps completed
                </Text>
              </Box>

              {/* Latest update */}
              {gradingProgress.latestUpdate && (
                <Box
                  style={{
                    width: "100%",
                    backgroundColor: "var(--gray-1)",
                    borderRadius: "6px",
                    padding: "12px",
                    border: "1px solid var(--gray-4)",
                  }}
                >
                  <Text
                    size="2"
                    style={{ color: "#000000", fontWeight: "500" }}
                  >
                    Latest: {gradingProgress.latestUpdate.message}
                  </Text>
                  {gradingProgress.latestUpdate.standard_name && (
                    <Text
                      size="2"
                      style={{ color: "#64748b", marginTop: "4px" }}
                    >
                      {gradingProgress.latestUpdate.standard_name}:{" "}
                      {gradingProgress.latestUpdate.score}/5
                    </Text>
                  )}
                </Box>
              )}

              <Text size="3" style={{ color: "#000000", lineHeight: "1.6" }}>
                Please wait while we analyze your performance and generate
                detailed feedback...
              </Text>
            </Flex>
          </Dialog.Content>
        </Dialog.Portal>

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
      </Dialog.Root>
    );
  }

  // If no feedback is available (neither old feedback nor rubric_grades), show a loading/empty state
  if (rubricGrades.length === 0) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={onClose}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.6)",
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
              padding: "32px",
              width: "90vw",
              maxWidth: "500px",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
              border: "1px solid var(--gray-6)",
            }}
          >
            <Flex
              direction="column"
              gap="6"
              align="center"
              style={{ textAlign: "center" }}
            >
              <Dialog.Title asChild>
                <Heading size="5" weight="medium" style={{ color: "#000000" }}>
                  No Feedback Available
                </Heading>
              </Dialog.Title>
              <Text size="3" style={{ color: "#000000", lineHeight: "1.6" }}>
                Feedback for {chat?.title} is not available yet. Please complete
                the session first to generate feedback.
              </Text>
              <Dialog.Close asChild>
                <Button variant="soft" size="3">
                  Close
                </Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Portal>

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
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
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
            padding: "0",
            width: "95vw",
            maxWidth: "1000px",
            height: "70vh",
            overflow: "hidden",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            border: "1px solid var(--gray-6)",
          }}
        >
          {/* Header */}
          <Box
            style={{
              background: "var(--gray-1)",
              padding: "16px 24px",
              borderBottom: "1px solid var(--gray-6)",
            }}
          >
            <Flex align="center" justify="between">
              <Flex align="center" gap="4">
                <Dialog.Title asChild>
                  <Heading
                    size="4"
                    weight="medium"
                    style={{ color: "#000000" }}
                  >
                    {chat?.title || "Assessment Feedback"}
                  </Heading>
                </Dialog.Title>
              </Flex>
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
          </Box>

          {/* Main Content */}
          <Box
            style={{
              flex: 1,
              overflow: "auto",
              height: "calc(70vh - 50px)",
              background: "white",
              padding: "0 20px 20px 20px",
            }}
          >
            {/* Standards Section */}
            {standardGrades && standardGrades.length > 0 && (
              <Box style={{ marginTop: "16px" }}>
                <Flex
                  align="center"
                  justify="between"
                  style={{ marginBottom: "16px" }}
                >
                  <Heading size="3" style={{ color: "#000000" }}>
                    Standards
                  </Heading>
                  <Box
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "var(--gray-1)",
                      borderRadius: "6px",
                      border: "1px solid var(--gray-4)",
                    }}
                  >
                    <ScoreDisplay
                      score={score ?? bestRubricGrade?.score ?? 0}
                      maxScore={rubric?.total_points || 100}
                    />
                  </Box>
                </Flex>
                <Accordion.Root type="single" collapsible>
                  {standardGrades.map((sg) => (
                    <Accordion.Item
                      key={sg.id}
                      value={sg.id}
                      style={{
                        border: "1px solid var(--gray-6)",
                        borderRadius: 8,
                        marginBottom: "8px",
                        overflow: "hidden",
                      }}
                    >
                      <Accordion.Trigger
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          backgroundColor: "white",
                          border: "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "background-color 0.2s ease",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        {/* Progress bar background */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            height: "100%",
                            width: `${(sg.score / 5) * 100}%`,
                            backgroundColor: getScoreColorHex(sg.score),
                            opacity: 0.15,
                            transition: "width 0.3s ease",
                            borderRadius: "6px",
                          }}
                        />

                        <Flex
                          align="center"
                          gap="2"
                          style={{ position: "relative", zIndex: 1 }}
                        >
                          <Text size="2" style={{ color: "#000000" }}>
                            {sg.name}
                          </Text>
                        </Flex>
                        <Flex
                          align="center"
                          gap="2"
                          style={{ position: "relative", zIndex: 1 }}
                        >
                          <Text
                            size="2"
                            weight="medium"
                            style={{
                              color: getScoreColorHex(sg.score, 5),
                              whiteSpace: "nowrap",
                              paddingRight: "8px",
                            }}
                          >
                            {sg.score}/5
                          </Text>
                          <ChevronDownIcon
                            width="16"
                            height="16"
                            style={{
                              transition: "transform 0.2s ease",
                              color: "#64748b",
                            }}
                          />
                        </Flex>
                      </Accordion.Trigger>
                      <Accordion.Content
                        style={{
                          padding: "12px 16px 16px 16px",
                          backgroundColor: "var(--gray-1)",
                        }}
                      >
                        <Text
                          size="2"
                          style={{
                            color: TEXT_COLOR,
                            lineHeight: "1.4",
                          }}
                        >
                          {sg.description ||
                            "No feedback available for this standard."}
                        </Text>
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </Box>
            )}

            {/* Strengths and Improvements Side by Side */}
            <Box style={{ marginTop: "32px" }}>
              <Flex
                direction="row"
                gap="4"
                style={{ height: "100%", minHeight: "300px" }}
              >
                {/* Strengths - Left Side */}
                <Box
                  style={{
                    flex: 1,
                    paddingRight: "16px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Heading
                    size="3"
                    style={{ marginBottom: "16px", color: "#000000" }}
                  >
                    Strengths
                  </Heading>
                  <Flex direction="column" style={{ flex: 1 }}>
                    {bestRubricGrade?.strengths &&
                    bestRubricGrade.strengths.length > 0 ? (
                      bestRubricGrade.strengths.map(
                        (strength: string, index: number) => (
                          <Box
                            key={index}
                            style={{
                              position: "relative",
                              padding: "12px 16px",
                              marginBottom:
                                index < bestRubricGrade.strengths.length - 1
                                  ? "12px"
                                  : "0",
                              backgroundColor: "white",
                              borderRadius: "8px",
                              boxShadow:
                                "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
                              border: "1px solid rgba(22, 163, 74, 0.2)",
                              transition: "all 0.2s ease",
                              cursor: "default",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                "0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)";
                            }}
                          >
                            <Text
                              size="2"
                              style={{
                                lineHeight: "1.6",
                                color: "#000000",
                                fontWeight: "400",
                              }}
                            >
                              {cleanText(strength)}
                            </Text>
                            <Box
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                bottom: 0,
                                width: "4px",
                                backgroundColor: "#16a34a",
                                borderTopLeftRadius: "12px",
                                borderBottomLeftRadius: "12px",
                              }}
                            />
                          </Box>
                        )
                      )
                    ) : (
                      <Box
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "2px dashed #d1d5db",
                        }}
                      >
                        <Text
                          size="2"
                          style={{ color: "#000000", fontStyle: "italic" }}
                        >
                          No specific strengths identified in this session.
                        </Text>
                      </Box>
                    )}
                  </Flex>
                </Box>

                {/* Divider */}
                <Box
                  style={{
                    width: "1px",
                    backgroundColor: "#e5e7eb",
                    margin: "0 16px",
                  }}
                />

                {/* Improvements - Right Side */}
                <Box
                  style={{
                    flex: 1,
                    paddingLeft: "16px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Heading
                    size="3"
                    style={{ marginBottom: "16px", color: "#000000" }}
                  >
                    Improvements
                  </Heading>
                  <Flex direction="column" style={{ flex: 1 }}>
                    {bestRubricGrade?.improvements &&
                    bestRubricGrade.improvements.length > 0 ? (
                      bestRubricGrade.improvements.map(
                        (improvement: string, index: number) => (
                          <Box
                            key={index}
                            style={{
                              position: "relative",
                              padding: "12px 16px",
                              marginBottom:
                                index < bestRubricGrade.improvements.length - 1
                                  ? "12px"
                                  : "0",
                              backgroundColor: "white",
                              borderRadius: "8px",
                              boxShadow:
                                "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
                              border: "1px solid rgba(245, 158, 11, 0.2)",
                              transition: "all 0.2s ease",
                              cursor: "default",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                "0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)";
                            }}
                          >
                            <Text
                              size="2"
                              style={{
                                lineHeight: "1.6",
                                color: "#000000",
                                fontWeight: "400",
                              }}
                            >
                              {cleanText(improvement)}
                            </Text>
                            <Box
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                bottom: 0,
                                width: "4px",
                                backgroundColor: "#f59e0b",
                                borderTopLeftRadius: "12px",
                                borderBottomLeftRadius: "12px",
                              }}
                            />
                          </Box>
                        )
                      )
                    ) : (
                      <Box
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          backgroundColor: "white",
                          borderRadius: "12px",
                          border: "2px dashed #d1d5db",
                        }}
                      >
                        <Text
                          size="2"
                          style={{ color: "#000000", fontStyle: "italic" }}
                        >
                          No specific improvements identified.
                        </Text>
                      </Box>
                    )}
                  </Flex>
                </Box>
              </Flex>
            </Box>
          </Box>
        </Dialog.Content>
      </Dialog.Portal>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        [data-radix-accordion-trigger][data-state="open"] svg {
          transform: rotate(180deg);
        }

        [data-radix-accordion-trigger]:hover {
          background-color: var(--gray-2) !important;
        }

        [data-radix-accordion-content] {
          overflow: hidden;
        }

        [data-radix-accordion-content][data-state="open"] {
          animation: slideDown 0.2s ease-out;
        }

        [data-radix-accordion-content][data-state="closed"] {
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            height: 0;
            opacity: 0;
          }
          to {
            height: var(--radix-accordion-content-height);
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            height: var(--radix-accordion-content-height);
            opacity: 1;
          }
          to {
            height: 0;
            opacity: 0;
          }
        }
      `}</style>
    </Dialog.Root>
  );
}

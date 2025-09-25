"use client";

import { useRubrics } from "@/lib/api/hooks/useRubrics";
import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import type { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import type {
  Chat,
  Feedback,
  Rubric,
  RubricGrade,
  StandardGrade,
} from "@/types";
import * as Accordion from "@radix-ui/react-accordion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  DotFilledIcon,
} from "@radix-ui/react-icons";
import { Badge, Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useState } from "react";
import ScoreDisplay from "./ScoreDisplay";

const TEXT_COLOR = "#000000"; // Black text for all content

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedback: Feedback | null;
  score?: number | null;
  chat?: Chat | null;
}

export default function FeedbackModal({
  isOpen,
  onClose,
  feedback,
  score,
  chat,
}: FeedbackModalProps) {
  const [currentPage, setCurrentPage] = useState(0);

  const { data: scenarios } = useScenariosByTrainingId(chat?.training_id || "");
  const { data: rubrics } = useRubrics();

  const cleanText = (text: string) => {
    // Remove markdown bold formatting (**text**)
    return text.replace(/\*\*(.*?)\*\*/g, "$1");
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.0) return "green"; // 80% and above (4.0/5.0 = 80%)
    if (score >= 3.0) return "yellow"; // 60-80% (3.0-3.9/5.0 = 60-78%)
    return "red"; // Below 60% (<3.0/5.0)
  };

  const getScoreColorHex = (score: number) => {
    if (score >= 4.0) return "#16a34a"; // Green
    if (score >= 3.0) return "#f59e0b"; // Yellow/Amber
    return "#ef4444"; // Red
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

  // If no feedback is available (neither old feedback nor rubric_grades), show a loading/empty state
  if (!feedback && rubricGrades.length === 0) {
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

  const pages = [
    {
      title: "Performance Scores",
      icon: "📊",
      color: "blue",
      content: (
        <Box style={{ padding: "24px" }}>
          <ScoreDisplay
            score={score ?? bestRubricGrade?.score ?? null}
            chat={chat || undefined}
            rubric={rubric as Rubric | null | undefined}
          />
          {standardGrades && standardGrades.length > 0 && (
            <>
              <Box style={{ marginTop: "24px", marginBottom: "12px" }}>
                <Heading
                  size="3"
                  style={{ marginBottom: "8px", color: "#000000" }}
                >
                  Standards
                </Heading>
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
                        }}
                      >
                        <Flex align="center" gap="2">
                          <Text size="2" style={{ color: "#000000" }}>
                            {sg.name}
                          </Text>
                        </Flex>
                        <Flex align="center">
                          <Badge
                            variant="soft"
                            color={getScoreColor(sg.score)}
                            style={{
                              backgroundColor: `${getScoreColorHex(
                                sg.score
                              )}20`,
                              color: getScoreColorHex(sg.score),
                              border: `1px solid ${getScoreColorHex(
                                sg.score
                              )}40`,
                              marginRight: "6px",
                            }}
                          >
                            {sg.score}/5
                          </Badge>
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
                          padding: "0 16px 16px 16px",
                          backgroundColor: "var(--gray-1)",
                        }}
                      >
                        <Text
                          size="2"
                          style={{
                            color: TEXT_COLOR,
                            lineHeight: "1.4",
                            paddingTop: "8px",
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
              <Box style={{ marginTop: "24px", marginBottom: "12px" }}>
                <Heading
                  size="3"
                  style={{ marginBottom: "8px", color: "#000000" }}
                >
                  Summary
                </Heading>
                <Text size="2" style={{ color: "#000000" }}>
                  {bestRubricGrade?.description ||
                    "No feedback available for this standard."}
                </Text>
              </Box>
            </>
          )}
        </Box>
      ),
    },
    {
      title: "Strengths",
      icon: "✓",
      color: "green",
      content: (
        <Box
          style={{
            padding: "48px",
            background: "white",
            height: "100%",
          }}
        >
          <Flex direction="column" gap="6">
            {bestRubricGrade?.strengths &&
            bestRubricGrade.strengths.length > 0 ? (
              <Flex direction="column" gap="6">
                {bestRubricGrade.strengths.map(
                  (strength: string, index: number) => (
                    <Box
                      key={index}
                      style={{
                        position: "relative",
                        padding: "28px 32px",
                        marginBottom: "16px",
                        backgroundColor: "white",
                        borderRadius: "16px",
                        boxShadow:
                          "0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)",
                        border: "1px solid rgba(22, 163, 74, 0.1)",
                        transition: "all 0.2s ease",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
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
                        size="3"
                        style={{
                          lineHeight: "1.7",
                          color: "#000000",
                          fontWeight: "400",
                          fontSize: "15px",
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
                          borderTopLeftRadius: "16px",
                          borderBottomLeftRadius: "16px",
                        }}
                      />
                    </Box>
                  )
                )}
              </Flex>
            ) : (
              <Box
                style={{
                  padding: "48px",
                  textAlign: "center",
                  backgroundColor: "white",
                  borderRadius: "16px",
                  border: "2px dashed #d1d5db",
                }}
              >
                <Text
                  size="3"
                  style={{ color: "#000000", fontStyle: "italic" }}
                >
                  No specific strengths identified in this session.
                </Text>
              </Box>
            )}
          </Flex>
        </Box>
      ),
    },
    {
      title: "Improvements",
      icon: "⚡",
      color: "amber",
      content: (
        <Box
          style={{
            padding: "48px",
            background: "white",
            height: "100%",
          }}
        >
          <Flex direction="column" gap="6">
            {bestRubricGrade?.improvements &&
            bestRubricGrade.improvements.length > 0 ? (
              <Flex direction="column" gap="6">
                {bestRubricGrade.improvements.map(
                  (improvement: string, index: number) => (
                    <Box
                      key={index}
                      style={{
                        position: "relative",
                        padding: "28px 32px",
                        marginBottom: "16px",
                        backgroundColor: "white",
                        borderRadius: "16px",
                        boxShadow:
                          "0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)",
                        border: "1px solid rgba(245, 158, 11, 0.1)",
                        transition: "all 0.2s ease",
                        cursor: "default",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
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
                        size="3"
                        style={{
                          lineHeight: "1.7",
                          color: "#000000",
                          fontWeight: "400",
                          fontSize: "15px",
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
                          borderTopLeftRadius: "16px",
                          borderBottomLeftRadius: "16px",
                        }}
                      />
                    </Box>
                  )
                )}
              </Flex>
            ) : (
              <Box
                style={{
                  padding: "48px",
                  textAlign: "center",
                  backgroundColor: "white",
                  borderRadius: "16px",
                  border: "2px dashed #d1d5db",
                }}
              >
                <Text
                  size="3"
                  style={{ color: "#000000", fontStyle: "italic" }}
                >
                  No specific improvements identified.
                </Text>
              </Box>
            )}
          </Flex>
        </Box>
      ),
    },
  ];

  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % pages.length);
  };

  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + pages.length) % pages.length);
  };

  const goToPage = (index: number) => {
    setCurrentPage(index);
  };

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
            width: "90vw",
            maxWidth: "600px",
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
              padding: "20px 32px",
              borderBottom: "1px solid var(--gray-6)",
            }}
          >
            <Flex align="center" justify="between">
              <Flex direction="column" gap="1">
                <Dialog.Title asChild>
                  <Heading
                    size="4"
                    weight="medium"
                    style={{ color: "#000000" }}
                  >
                    Assessment Feedback
                  </Heading>
                </Dialog.Title>
                <Flex direction="column" align="center" gap="2">
                  <Text size="2" style={{ color: "#000000" }}>
                    Session: {chat?.title}
                  </Text>
                </Flex>
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

          {/* Page Navigation Tabs */}
          <Box
            style={{
              background: "var(--gray-1)",
              borderBottom: "1px solid var(--gray-6)",
            }}
          >
            <Flex align="center" justify="center">
              {pages.map((page, index) => (
                <Box
                  key={index}
                  onClick={() => goToPage(index)}
                  style={{
                    padding: "16px 24px",
                    cursor: "pointer",
                    borderBottom:
                      currentPage === index
                        ? "3px solid var(--blue-9)"
                        : "3px solid transparent",
                    backgroundColor:
                      currentPage === index ? "white" : "transparent",
                    transition: "all 0.2s ease",
                    fontWeight: currentPage === index ? "600" : "500",
                  }}
                >
                  <Text
                    size="2"
                    style={{
                      color:
                        currentPage === index ? "var(--blue-11)" : "#000000",
                    }}
                  >
                    {page.title}
                  </Text>
                </Box>
              ))}
            </Flex>
          </Box>

          {/* Page Content */}
          <Box
            style={{
              flex: 1,
              overflow: "auto",
              height: "calc(70vh - 160px)",
              background: "white",
            }}
          >
            {pages[currentPage].content}
          </Box>

          {/* Footer Navigation */}
          <Box
            style={{
              background: "var(--gray-1)",
              padding: "16px 32px",
              borderTop: "1px solid var(--gray-6)",
            }}
          >
            <Flex align="center" justify="between">
              <Button
                variant="soft"
                size="2"
                onClick={prevPage}
                disabled={currentPage === 0}
              >
                <ChevronLeftIcon />
                Previous
              </Button>

              {/* Page Indicators */}
              <Flex align="center" gap="1">
                {pages.map((_, index) => (
                  <DotFilledIcon
                    key={index}
                    width="12"
                    height="12"
                    color={
                      currentPage === index ? "var(--gray-12)" : "var(--gray-8)"
                    }
                    style={{ cursor: "pointer" }}
                    onClick={() => goToPage(index)}
                  />
                ))}
              </Flex>

              <Button
                variant="soft"
                size="2"
                onClick={nextPage}
                disabled={currentPage === pages.length - 1}
              >
                Next
                <ChevronRightIcon />
              </Button>
            </Flex>
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

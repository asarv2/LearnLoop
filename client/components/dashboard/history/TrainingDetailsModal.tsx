/**
 * TrainingDetailsModal.tsx
 * Modal component to display training attempt details without navigation
 * @siladie
 * 01-29-2025
 */
"use client";

import { useChatForAttempt } from "@/lib/api/hooks/useChats";
import { useRubricGradesByChat } from "@/lib/api/hooks/useRubricGrades";
import { useScenario } from "@/lib/api/hooks/useScenarios";
import { useTrainingMessages } from "@/lib/api/hooks/useTrainingMessages";
import type { ChatWithAllIncludes } from "@/lib/repos/chatRepo";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Card, Col, List, Modal, Row, Tag, Typography } from "antd";
import { useMemo } from "react";

const { Title, Text, Paragraph } = Typography;

interface TrainingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  attemptId: string;
}

// Helper component to display score
function ScoreDisplay({
  chatId,
  isCompleted,
}: {
  chatId: string;
  isCompleted: boolean;
}) {
  const { data: grades, isLoading } = useRubricGradesByChat(
    chatId,
    isCompleted
  );

  if (!isCompleted) {
    return <Tag color="orange">Incomplete</Tag>;
  }

  if (isLoading) {
    return <Tag color="blue">Loading...</Tag>;
  }

  if (!grades || grades.length === 0) {
    return <Tag color="default">No score</Tag>;
  }

  // Calculate average score from all rubric grades
  const totalScore = grades.reduce((sum, grade) => sum + (grade.score || 0), 0);
  const averageScore =
    grades.length > 0 ? Math.round(totalScore / grades.length) : 0;

  return (
    <Tag
      color={
        averageScore >= 80 ? "green" : averageScore >= 60 ? "orange" : "red"
      }
    >
      {averageScore}%
    </Tag>
  );
}

export default function TrainingDetailsModal({
  isOpen,
  onClose,
  attemptId,
}: TrainingDetailsModalProps) {
  const { data: chat, isLoading: chatLoading } = useChatForAttempt(attemptId);
  const { data: messages, isLoading: messagesLoading } = useTrainingMessages(
    chat?.id || "",
    Boolean(chat?.id)
  );
  const { data: scenario } = useScenario(
    chat?.scenario_id || "",
    Boolean(chat?.scenario_id)
  );

  // Get feedback data from chat - using rubric_grades instead of old feedback table
  const rubricGrades = chat?.rubric_grades || [];

  const isLoading = chatLoading || messagesLoading;

  // Format messages for display
  const formattedMessages = useMemo(() => {
    if (!messages) return [];

    return messages.map((message) => ({
      key: message.id,
      sender: message.role === "user" ? "You" : "AI Trainer",
      content: message.content,
      timestamp: message.created_at,
      isUser: message.role === "user",
    }));
  }, [messages]);

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onClose}
            style={{ padding: "4px 8px" }}
          />
          <Title level={4} style={{ margin: 0 }}>
            Training Details
          </Title>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      width="90%"
      style={{ maxWidth: "1200px" }}
      footer={null}
      destroyOnClose
    >
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "50px" }}>
          <Text>Loading training details...</Text>
        </div>
      ) : !chat ? (
        <div style={{ textAlign: "center", padding: "50px" }}>
          <Text type="secondary">No training data found</Text>
        </div>
      ) : (
        <div
          style={{ height: "70vh", display: "flex", flexDirection: "column" }}
        >
          <Row gutter={[16, 16]} style={{ flex: 1, height: "100%" }}>
            {/* Left Column - Scenario Info (1/4 width) */}
            <Col xs={24} lg={6} style={{ height: "100%" }}>
              <Card
                title="Scenario Information"
                size="small"
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                bodyStyle={{ flex: 1, overflowY: "auto" }}
              >
                <div style={{ marginBottom: "16px" }}>
                  <Title level={5} style={{ margin: "0 0 8px 0" }}>
                    {scenario?.title || chat.title || "Untitled Scenario"}
                  </Title>
                  <Text type="secondary">
                    Training: {chat?.title || "Unknown Training"}
                  </Text>
                </div>

                {scenario?.problem_statement && (
                  <div style={{ marginBottom: "16px" }}>
                    <Title level={5}>Problem Statement</Title>
                    <Paragraph style={{ fontSize: "14px", margin: 0 }}>
                      {scenario.problem_statement}
                    </Paragraph>
                  </div>
                )}

                {scenario?.objectives && scenario.objectives.length > 0 && (
                  <div>
                    <Title level={5}>Objectives</Title>
                    <List
                      size="small"
                      dataSource={scenario.objectives}
                      renderItem={(objective, index) => (
                        <List.Item
                          style={{ padding: "4px 0", fontSize: "14px" }}
                        >
                          <Text>
                            {index + 1}. {String(objective)}
                          </Text>
                        </List.Item>
                      )}
                    />
                  </div>
                )}
              </Card>
            </Col>

            {/* Middle Column - Chat Messages (1/2 width) */}
            <Col xs={24} lg={12} style={{ height: "100%" }}>
              <Card
                title="Conversation History"
                size="small"
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                bodyStyle={{ flex: 1, overflowY: "auto" }}
              >
                {formattedMessages.length === 0 ? (
                  <Text type="secondary">No messages found</Text>
                ) : (
                  <List
                    dataSource={formattedMessages}
                    renderItem={(message) => (
                      <List.Item style={{ padding: "12px 0", border: "none" }}>
                        <div style={{ width: "100%" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: message.isUser
                                ? "flex-end"
                                : "flex-start",
                              marginBottom: "8px",
                            }}
                          >
                            <div
                              style={{
                                maxWidth: "80%",
                                padding: "12px 16px",
                                borderRadius: "12px",
                                backgroundColor: message.isUser
                                  ? "#1890ff"
                                  : "#f5f5f5",
                                color: message.isUser ? "white" : "black",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  opacity: 0.7,
                                  marginBottom: "4px",
                                  fontWeight: "bold",
                                }}
                              >
                                {message.sender}
                              </div>
                              <div
                                style={{
                                  whiteSpace: "pre-wrap",
                                  fontSize: "14px",
                                }}
                              >
                                {message.content}
                              </div>
                            </div>
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              </Card>
            </Col>

            {/* Right Column - Score & Feedback (1/4 width) */}
            <Col xs={24} lg={6} style={{ height: "100%" }}>
              <Card
                title="Score & Feedback"
                size="small"
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                bodyStyle={{ flex: 1, overflowY: "auto" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    height: "100%",
                  }}
                >
                  {/* Score Section */}
                  <div>
                    <Title level={5}>Score</Title>
                    {chat.completed ? (
                      <ScoreDisplay
                        chatId={chat.id}
                        isCompleted={chat.completed}
                      />
                    ) : (
                      <Tag color="orange">Incomplete Conversation</Tag>
                    )}
                  </div>

                  {/* Feedback Section */}
                  <div>
                    <Title level={5}>Feedback</Title>
                    {chat.completed ? (
                      rubricGrades.length > 0 ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                          }}
                        >
                          {rubricGrades.map(
                            (
                              grade: ChatWithAllIncludes["rubric_grades"][0],
                              index: number
                            ) => (
                              <div key={index}>
                                <Text
                                  strong
                                  style={{ fontSize: "12px", color: "#1890ff" }}
                                >
                                  {grade.name}: {grade.score}/100
                                </Text>
                                {grade.description && (
                                  <Text
                                    style={{ fontSize: "11px", color: "#666" }}
                                  >
                                    {grade.description}
                                  </Text>
                                )}

                                {/* Strengths */}
                                {grade.strengths &&
                                  grade.strengths.length > 0 && (
                                    <div style={{ marginTop: "4px" }}>
                                      <Text
                                        style={{
                                          fontSize: "11px",
                                          color: "#52c41a",
                                        }}
                                      >
                                        Strengths:
                                      </Text>
                                      <List
                                        size="small"
                                        dataSource={grade.strengths}
                                        renderItem={(strength) => (
                                          <List.Item
                                            style={{
                                              padding: "1px 0",
                                              fontSize: "11px",
                                            }}
                                          >
                                            <Text style={{ color: "#52c41a" }}>
                                              • {String(strength)}
                                            </Text>
                                          </List.Item>
                                        )}
                                      />
                                    </div>
                                  )}

                                {/* Improvements */}
                                {grade.improvements &&
                                  grade.improvements.length > 0 && (
                                    <div style={{ marginTop: "4px" }}>
                                      <Text
                                        style={{
                                          fontSize: "11px",
                                          color: "#ff4d4f",
                                        }}
                                      >
                                        Areas for Improvement:
                                      </Text>
                                      <List
                                        size="small"
                                        dataSource={grade.improvements}
                                        renderItem={(improvement) => (
                                          <List.Item
                                            style={{
                                              padding: "1px 0",
                                              fontSize: "11px",
                                            }}
                                          >
                                            <Text style={{ color: "#ff4d4f" }}>
                                              • {String(improvement)}
                                            </Text>
                                          </List.Item>
                                        )}
                                      />
                                    </div>
                                  )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          No feedback available
                        </Text>
                      )
                    ) : (
                      <Tag color="orange">Incomplete Conversation</Tag>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}
    </Modal>
  );
}

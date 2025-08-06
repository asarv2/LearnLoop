/**
 * BestPractices.tsx
 * Used to show the best practices of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useAttempts } from "@/lib/api/hooks/useAttempts";
import { useChats } from "@/lib/api/hooks/useChats";
import { useTrainings } from "@/lib/api/hooks/useTrainings";
import {
  BarChartOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  HeartOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SafetyOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  List,
  Row,
  Space,
  Typography,
} from "antd";
import Link from "next/link";
import { useState } from "react";

const { Title, Text, Paragraph } = Typography;

// Array of colors and icons for training modules (matching other components)
const trainingColors = [
  "#1890ff",
  "#fa8c16",
  "#52c41a",
  "#eb2f96",
  "#722ed1",
  "#13c2c2",
  "#fa541c",
  "#a0d911",
  "#f5222d",
  "#2f54eb",
];

const trainingIcons = [
  <PlayCircleOutlined key="play" />,
  <UserDeleteOutlined key="user-delete" />,
  <TeamOutlined key="team" />,
  <CommentOutlined key="comment" />,
  <ExclamationCircleOutlined key="exclamation" />,
  <BulbOutlined key="bulb" />,
  <TrophyOutlined key="trophy" />,
  <SafetyOutlined key="safety" />,
  <HeartOutlined key="heart" />,
  <RocketOutlined key="rocket" />,
];

export default function BestPractices() {
  const [selectedTraining, setSelectedTraining] = useState<string | null>(null);

  const { data: attempts } = useAttempts();
  const { data: chats } = useChats();
  const { data: trainings } = useTrainings();

  // Filter practice trainings and sort active ones first
  const practiceTrainings =
    trainings
      ?.filter((training) => training.practice)
      .sort((a, b) => {
        if (a.active && !b.active) return -1;
        if (!a.active && b.active) return 1;
        return 0;
      }) || [];

  // Sort chats by creation date (newest first)
  const sortedChats =
    chats?.sort(
      (a, b) =>
        new Date(b.created_at || "").getTime() -
        new Date(a.created_at || "").getTime()
    ) || [];

  // Create training modules with colors and icons
  const trainingModules = practiceTrainings.map((training, index) => {
    const color = trainingColors[index % trainingColors.length];
    const icon = trainingIcons[index % trainingIcons.length];
    const status = training.active ? "available" : "coming-soon";

    // Get attempts for this training
    const trainingAttempts =
      attempts?.filter((attempt) => attempt.training_id === training.id) || [];

    // Get chats for this training through attempts
    const trainingChats = sortedChats.filter((chat) =>
      trainingAttempts.some((attempt) => attempt.id === chat.attempt_id)
    );

    return {
      id: training.id,
      title: training.title,
      description: training.description,
      color,
      icon,
      status,
      training,
      attempts: trainingAttempts,
      chats: trainingChats,
      whatToDo: training.what_to_do || [],
      whatNotToDo: training.what_not_to_do || [],
    };
  });

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <Title level={2}>Training Best Practices & Guidance</Title>
        <Paragraph type="secondary" style={{ fontSize: "16px" }}>
          Improve your professional skills across all simulation types with
          proven strategies and personalized recommendations.
        </Paragraph>
      </div>

      {selectedTraining ? (
        // Detailed view for selected training
        <div>
          <Button
            icon={<BulbOutlined />}
            onClick={() => setSelectedTraining(null)}
            style={{ marginBottom: "24px" }}
          >
            Back to All Trainings
          </Button>

          {(() => {
            const training = trainingModules.find(
              (t) => t.id === selectedTraining
            );

            if (!training) return null;

            return (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <div style={{ color: training.color }}>
                          {training.icon}
                        </div>
                        <span>{training.title} - Best Practices</span>
                      </Space>
                    }
                  >
                    <div style={{ marginBottom: "24px" }}>
                      <Title
                        level={5}
                        style={{ color: "#52c41a", marginBottom: "16px" }}
                      >
                        <CheckCircleOutlined /> What to Do Well
                      </Title>
                      {training.whatToDo.length > 0 ? (
                        <List
                          size="small"
                          dataSource={training.whatToDo}
                          renderItem={(item) => (
                            <List.Item>
                              <Text>{item}</Text>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Text type="secondary">
                          No specific guidance available yet.
                        </Text>
                      )}
                    </div>

                    <Divider />

                    <div>
                      <Title
                        level={5}
                        style={{ color: "#ff4d4f", marginBottom: "16px" }}
                      >
                        <CloseCircleOutlined /> Common Mistakes
                      </Title>
                      {training.whatNotToDo.length > 0 ? (
                        <List
                          size="small"
                          dataSource={training.whatNotToDo}
                          renderItem={(item) => (
                            <List.Item>
                              <Text>{item}</Text>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Text type="secondary">
                          No specific guidance available yet.
                        </Text>
                      )}
                    </div>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <BarChartOutlined />
                        <span>Your Performance Insights</span>
                      </Space>
                    }
                  >
                    {training.attempts.length > 0 ? (
                      <Space
                        direction="vertical"
                        style={{ width: "100%" }}
                        size="middle"
                      >
                        <Row gutter={16}>
                          <Col span={8} style={{ textAlign: "center" }}>
                            <Text
                              style={{
                                fontSize: "24px",
                                fontWeight: "bold",
                                color: "#1890ff",
                              }}
                            >
                              {training.attempts.length}
                            </Text>
                            <br />
                            <Text type="secondary">Sessions</Text>
                          </Col>
                          <Col span={8} style={{ textAlign: "center" }}>
                            <Text
                              style={{
                                fontSize: "24px",
                                fontWeight: "bold",
                                color: "#52c41a",
                              }}
                            >
                              {
                                training.attempts.filter((attempt) =>
                                  training.chats.some(
                                    (chat) =>
                                      chat.attempt_id === attempt.id &&
                                      chat.completed_at
                                  )
                                ).length
                              }
                            </Text>
                            <br />
                            <Text type="secondary">Completed</Text>
                          </Col>
                          <Col span={8} style={{ textAlign: "center" }}>
                            <Text
                              style={{
                                fontSize: "24px",
                                fontWeight: "bold",
                                color: "#722ed1",
                              }}
                            >
                              {(() => {
                                // Get completed attempts (attempts that have completed chats)
                                const completedAttempts =
                                  training.attempts.filter((attempt) =>
                                    training.chats.some(
                                      (chat) =>
                                        chat.attempt_id === attempt.id &&
                                        chat.completed_at
                                    )
                                  );

                                if (completedAttempts.length === 0) return 0;

                                const totalTime = completedAttempts.reduce(
                                  (acc, attempt) => {
                                    // Find the first and last chat for this attempt
                                    const attemptChats = training.chats
                                      .filter(
                                        (chat) => chat.attempt_id === attempt.id
                                      )
                                      .sort(
                                        (a, b) =>
                                          new Date(
                                            a.created_at || ""
                                          ).getTime() -
                                          new Date(b.created_at || "").getTime()
                                      );

                                    if (attemptChats.length === 0) return acc;

                                    const firstChat = attemptChats[0];
                                    const lastCompletedChat = attemptChats
                                      .reverse()
                                      .find((chat) => chat.completed_at);

                                    if (!lastCompletedChat) return acc;

                                    const start = new Date(
                                      firstChat.created_at || ""
                                    );
                                    const end = new Date(
                                      lastCompletedChat.completed_at || ""
                                    );

                                    return (
                                      acc + (end.getTime() - start.getTime())
                                    );
                                  },
                                  0
                                );

                                return Math.round(
                                  totalTime /
                                    completedAttempts.length /
                                    (1000 * 60)
                                );
                              })()}
                            </Text>
                            <br />
                            <Text type="secondary">Avg Minutes</Text>
                          </Col>
                        </Row>

                        <Divider />

                        <div>
                          <Title level={5}>Recent Sessions</Title>
                          <List
                            size="small"
                            dataSource={training.attempts.slice(0, 3)}
                            renderItem={(attempt) => {
                              const attemptChats = training.chats.filter(
                                (chat) => chat.attempt_id === attempt.id
                              );
                              const firstChat = attemptChats[0];
                              const isCompleted = attemptChats.some(
                                (chat) => chat.completed_at
                              );

                              return (
                                <List.Item>
                                  <Space direction="vertical" size={2}>
                                    <Text strong>
                                      {firstChat?.title || "Untitled Session"}
                                    </Text>
                                    <Text
                                      type="secondary"
                                      style={{ fontSize: "12px" }}
                                    >
                                      {new Date(
                                        attempt.created_at || ""
                                      ).toLocaleDateString()}
                                      {isCompleted && <span> - Completed</span>}
                                    </Text>
                                  </Space>
                                </List.Item>
                              );
                            }}
                          />
                        </div>

                        {training.attempts.length > 0 && (
                          <>
                            <Divider />
                            <Alert
                              message="Performance Tip"
                              description={`Based on your ${
                                training.attempts.length
                              } sessions, focus on the best practices above to improve your ${training.title.toLowerCase()} skills.`}
                              type="info"
                              showIcon
                            />
                          </>
                        )}
                      </Space>
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <Text type="secondary">
                          No sessions completed for this training yet.
                        </Text>
                        <br />
                        <Link href="/dashboard/trainings">
                          <Button type="primary" style={{ marginTop: "16px" }}>
                            Start Your First Session
                          </Button>
                        </Link>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            );
          })()}
        </div>
      ) : (
        // Grid view of all trainings
        <Row gutter={[24, 24]}>
          {trainingModules.map((training) => (
            <Col xs={24} sm={12} lg={8} key={training.id}>
              <Card
                hoverable={training.status === "available"}
                onClick={() =>
                  training.status === "available" &&
                  training.id &&
                  setSelectedTraining(training.id)
                }
                style={{
                  height: "100%",
                  cursor:
                    training.status === "available" ? "pointer" : "default",
                  transition: "all 0.3s ease",
                  opacity: training.status === "coming-soon" ? 0.8 : 1,
                }}
              >
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <div
                    style={{
                      fontSize: "48px",
                      color: training.color,
                      marginBottom: "12px",
                    }}
                  >
                    {training.icon}
                  </div>
                  <Title level={4} style={{ margin: 0 }}>
                    {training.title}
                    {training.status === "coming-soon" && (
                      <div style={{ marginTop: "8px" }}>
                        <Badge
                          count="Soon"
                          style={{ backgroundColor: "#fa8c16" }}
                        />
                      </div>
                    )}
                  </Title>
                </div>

                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <Text
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: training.color,
                    }}
                  >
                    {training.attempts.length}
                  </Text>
                  <br />
                  <Text type="secondary">Sessions Completed</Text>
                </div>

                <div style={{ textAlign: "center" }}>
                  {training.status === "available" ? (
                    <Button
                      type="primary"
                      style={{
                        backgroundColor: training.color,
                        borderColor: training.color,
                      }}
                    >
                      View Guidance
                    </Button>
                  ) : (
                    <Button
                      disabled
                      style={{
                        backgroundColor: training.color,
                        borderColor: training.color,
                      }}
                    >
                      Coming Soon
                    </Button>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}

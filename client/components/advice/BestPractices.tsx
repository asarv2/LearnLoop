/**
 * BestPractices.tsx
 * Used to show the best practices of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { getChats } from "@/utils/queries/chats/get-all-chats";
import {
  BarChartOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
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

export default function BestPractices() {
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(
    null
  );

  const { data: sessions } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getChats(),
  });

  const sortedSessions =
    sessions?.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || [];

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <Title level={2}>Training Best Practices & Guidance</Title>
        <Paragraph type="secondary" style={{ fontSize: "16px" }}>
          Improve your professional skills across all simulation types with
          proven strategies and personalized recommendations.
        </Paragraph>
      </div>

      {selectedSimulation ? (
        // Detailed view for selected simulation
        <div>
          <Button
            icon={<BulbOutlined />}
            onClick={() => setSelectedSimulation(null)}
            style={{ marginBottom: "24px" }}
          >
            Back to All Simulations
          </Button>

          {(() => {
            const simulation = simulationTypes.find(
              (s) => s.id === selectedSimulation
            );
            const simulationSessions = sortedSessions.filter(
              (session) =>
                session.type === selectedSimulation ||
                (selectedSimulation === "interview" &&
                  ["regular", "ai-assisted", "cheating"].includes(session.type))
            );

            return (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <Space>
                        <div style={{ color: simulation?.color }}>
                          {simulation?.icon}
                        </div>
                        <span>{simulation?.title} - Best Practices</span>
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
                      <List
                        size="small"
                        dataSource={simulation?.dos || []}
                        renderItem={(item) => (
                          <List.Item>
                            <Text>{item}</Text>
                          </List.Item>
                        )}
                      />
                    </div>

                    <Divider />

                    <div>
                      <Title
                        level={5}
                        style={{ color: "#ff4d4f", marginBottom: "16px" }}
                      >
                        <CloseCircleOutlined /> Common Mistakes
                      </Title>
                      <List
                        size="small"
                        dataSource={simulation?.donts || []}
                        renderItem={(item) => (
                          <List.Item>
                            <Text>{item}</Text>
                          </List.Item>
                        )}
                      />
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
                    {simulationSessions.length > 0 ? (
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
                              {simulationSessions.length}
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
                                simulationSessions.filter((s) => s.completed_at)
                                  .length
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
                              {simulationSessions.filter((s) => s.completed_at)
                                .length > 0
                                ? Math.round(
                                    simulationSessions
                                      .filter((s) => s.completed_at)
                                      .reduce((acc, s) => {
                                        const start = new Date(s.created_at);
                                        const end = s.completed_at
                                          ? new Date(s.completed_at)
                                          : start;
                                        return (
                                          acc +
                                          (end.getTime() - start.getTime())
                                        );
                                      }, 0) /
                                      simulationSessions.filter(
                                        (s) => s.completed_at
                                      ).length /
                                      (1000 * 60)
                                  )
                                : 0}
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
                            dataSource={simulationSessions.slice(0, 3)}
                            renderItem={(session) => (
                              <List.Item>
                                <Space direction="vertical" size={2}>
                                  <Text strong>
                                    {session.title || "Untitled Session"}
                                  </Text>
                                  <Text
                                    type="secondary"
                                    style={{ fontSize: "12px" }}
                                  >
                                    {new Date(
                                      session.created_at
                                    ).toLocaleDateString()}
                                    {session.completed_at && (
                                      <span> - Completed</span>
                                    )}
                                  </Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </div>

                        {simulationSessions.length > 0 && (
                          <>
                            <Divider />
                            <Alert
                              message="Performance Tip"
                              description={`Based on your ${
                                simulationSessions.length
                              } sessions, focus on the best practices above to improve your ${simulation?.title.toLowerCase()} skills.`}
                              type="info"
                              showIcon
                            />
                          </>
                        )}
                      </Space>
                    ) : (
                      <div style={{ textAlign: "center", padding: "40px 0" }}>
                        <Text type="secondary">
                          No sessions completed for this simulation type yet.
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
        // Grid view of all simulations
        <Row gutter={[24, 24]}>
          {simulationTypes.map((simulation) => {
            const sessionCount = sortedSessions.filter(
              (session) =>
                session.type === simulation.id ||
                (simulation.id === "interview" &&
                  ["regular", "ai-assisted", "cheating"].includes(session.type))
            ).length;

            return (
              <Col xs={24} sm={12} lg={8} key={simulation.id}>
                <Card
                  hoverable
                  onClick={() => setSelectedSimulation(simulation.id)}
                  style={{
                    height: "100%",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "48px",
                        color: simulation.color,
                        marginBottom: "12px",
                      }}
                    >
                      {simulation.icon}
                    </div>
                    <Title level={4} style={{ margin: 0 }}>
                      {simulation.title}
                    </Title>
                  </div>

                  <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <Text
                      style={{
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: simulation.color,
                      }}
                    >
                      {sessionCount}
                    </Text>
                    <br />
                    <Text type="secondary">Sessions Completed</Text>
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <Button
                      type="primary"
                      style={{
                        backgroundColor: simulation.color,
                        borderColor: simulation.color,
                      }}
                    >
                      View Guidance
                    </Button>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}

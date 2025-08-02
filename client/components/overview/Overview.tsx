/**
 * Overview.tsx
 * Used to show the overview of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useChats } from "@/lib/api/hooks/useChats";
import { Chat } from "@/types";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Divider,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useMemo } from "react";

const { Title, Text } = Typography;

export default function Overview() {
  const { data: chats, isLoading } = useChats();

  // Sort chats by newest first
  const sortedChats = useMemo(
    () =>
      chats?.sort(
        (a, b) =>
          new Date(b.created_at || "").getTime() -
          new Date(a.created_at || "").getTime()
      ) || [],
    [chats]
  );

  // Calculate progress metrics
  const progressMetrics = useMemo(() => {
    const totalChats = sortedChats.length;
    const completedChats = sortedChats.filter(
      (chat) => chat.completed_at
    ).length;
    const completionRate =
      totalChats > 0 ? (completedChats / totalChats) * 100 : 0;

    const thisMonth = new Date();
    thisMonth.setDate(1);
    const thisMonthChats = sortedChats.filter(
      (chat) => new Date(chat.created_at || "") >= thisMonth
    ).length;

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setDate(1);
    const lastMonthChats = sortedChats.filter((chat) => {
      const chatDate = new Date(chat.created_at || "");
      return chatDate >= lastMonth && chatDate < thisMonth;
    }).length;

    const monthOverMonth =
      lastMonthChats > 0
        ? ((thisMonthChats - lastMonthChats) / lastMonthChats) * 100
        : 0;

    return {
      totalChats,
      completedChats,
      completionRate,
      thisMonthChats,
      lastMonthChats,
      monthOverMonth,
    };
  }, [sortedChats]);

  // Calculate performance trends
  const performanceTrends = useMemo(() => {
    const completedChats = sortedChats.filter((chat) => chat.completed_at);
    const recentChats = completedChats.slice(0, 5);

    const avgDuration =
      completedChats.length > 0
        ? completedChats.reduce((acc, chat) => {
            const start = new Date(chat.created_at || "");
            const end = chat.completed_at ? new Date(chat.completed_at) : start;
            return acc + (end.getTime() - start.getTime());
          }, 0) /
          completedChats.length /
          (1000 * 60)
        : 0;

    return {
      recentChats,
      avgDuration: Math.round(avgDuration),
    };
  }, [sortedChats]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusTag = (chat: Partial<Chat>) => {
    if (chat.completed_at) {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          Completed
        </Tag>
      );
    }
    return (
      <Tag color="processing" icon={<ClockCircleOutlined />}>
        In Progress
      </Tag>
    );
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Text>Loading dashboard...</Text>
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Training Simulations Dashboard
      </Title>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total chats"
              value={progressMetrics.totalChats}
              prefix={<UserOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completed"
              value={progressMetrics.completedChats}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="This Month"
              value={progressMetrics.thisMonthChats}
              prefix={
                progressMetrics.monthOverMonth >= 0 ? (
                  <ArrowUpOutlined />
                ) : (
                  <ArrowDownOutlined />
                )
              }
              suffix={`${Math.abs(progressMetrics.monthOverMonth).toFixed(1)}%`}
              valueStyle={{
                color:
                  progressMetrics.monthOverMonth >= 0 ? "#52c41a" : "#ff4d4f",
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg Duration"
              value={performanceTrends.avgDuration}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Progress Overview */}
        <Col xs={24} lg={12}>
          <Card title="Progress Overview" extra={<TrophyOutlined />}>
            <div style={{ marginBottom: "24px" }}>
              <Text strong>Completion Rate</Text>
              <Progress
                percent={Math.round(progressMetrics.completionRate)}
                strokeColor={{
                  "0%": "#1890ff",
                  "100%": "#722ed1",
                }}
                style={{ marginTop: "8px" }}
              />
            </div>

            <Row gutter={16}>
              <Col span={8} style={{ textAlign: "center" }}>
                <Statistic
                  title="Completed"
                  value={progressMetrics.completedChats}
                  valueStyle={{ color: "#52c41a", fontSize: "24px" }}
                />
              </Col>
              <Col span={8} style={{ textAlign: "center" }}>
                <Statistic
                  title="In Progress"
                  value={
                    progressMetrics.totalChats - progressMetrics.completedChats
                  }
                  valueStyle={{ color: "#1890ff", fontSize: "24px" }}
                />
              </Col>
              <Col span={8} style={{ textAlign: "center" }}>
                <Statistic
                  title="Avg Minutes"
                  value={performanceTrends.avgDuration}
                  valueStyle={{ color: "#722ed1", fontSize: "24px" }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Recent Activity */}
        <Col xs={24} lg={12}>
          <Card
            title="Recent Activity"
            extra={
              <Link href="/dashboard/history">
                <Button type="link">View All</Button>
              </Link>
            }
          >
            {performanceTrends.recentChats.length > 0 ? (
              <List
                dataSource={performanceTrends.recentChats.slice(0, 5)}
                renderItem={(chat) => (
                  <List.Item
                    actions={[
                      <Link
                        key="view"
                        href={`/training/${
                          chat.training_type || "interview"
                        }/c/${chat.id}`}
                      >
                        <Button
                          type="text"
                          icon={<PlayCircleOutlined />}
                          size="small"
                        >
                          Review
                        </Button>
                      </Link>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{chat.title || "Untitled Session"}</Text>
                          {getStatusTag(chat)}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Text type="secondary">
                            {chat.name || "Unknown Participant"}
                          </Text>
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            {formatDate(chat.created_at || "")}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Text type="secondary">No recent activity</Text>
                <br />
                <Link href="/dashboard/trainings">
                  <Button type="primary" style={{ marginTop: "16px" }}>
                    Start First Simulation
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Analytics Section */}
      {sortedChats.length > 0 && (
        <>
          <Divider style={{ margin: "32px 0" }} />
          <Title level={3} style={{ marginBottom: "24px" }}>
            Analytics
          </Title>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Training Types Distribution">
                <div>
                  {["interview", "offboarding"].map((trainingType) => {
                    const count = sortedChats.filter(
                      (session) =>
                        (session.training_type || "interview") === trainingType
                    ).length;
                    const percentage =
                      sortedChats.length > 0
                        ? (count / sortedChats.length) * 100
                        : 0;

                    return (
                      <div key={trainingType} style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <Space>
                            <Tag
                              color={
                                trainingType === "interview" ? "blue" : "orange"
                              }
                            >
                              {trainingType.toUpperCase()}
                            </Tag>
                            <Text>
                              {trainingType.charAt(0).toUpperCase() +
                                trainingType.slice(1)}{" "}
                              Training
                            </Text>
                          </Space>
                          <Text type="secondary">
                            {count} ({percentage.toFixed(1)}%)
                          </Text>
                        </div>
                        <Progress
                          percent={Math.round(percentage)}
                          showInfo={false}
                          strokeColor={
                            trainingType === "interview" ? "#1890ff" : "#fa8c16"
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Monthly Trends">
                <Row gutter={16} style={{ marginBottom: "24px" }}>
                  <Col span={12} style={{ textAlign: "center" }}>
                    <Statistic
                      title="This Month"
                      value={progressMetrics.thisMonthChats}
                      valueStyle={{ color: "#fa8c16", fontSize: "32px" }}
                    />
                  </Col>
                  <Col span={12} style={{ textAlign: "center" }}>
                    <Statistic
                      title="Last Month"
                      value={progressMetrics.lastMonthChats}
                      valueStyle={{ color: "#1890ff", fontSize: "32px" }}
                    />
                  </Col>
                </Row>

                <div style={{ textAlign: "center" }}>
                  <Space>
                    {progressMetrics.monthOverMonth >= 0 ? (
                      <ArrowUpOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <ArrowDownOutlined style={{ color: "#ff4d4f" }} />
                    )}
                    <Text
                      style={{
                        color:
                          progressMetrics.monthOverMonth >= 0
                            ? "#52c41a"
                            : "#ff4d4f",
                        fontWeight: "bold",
                      }}
                    >
                      {Math.abs(progressMetrics.monthOverMonth).toFixed(1)}%
                      from last month
                    </Text>
                  </Space>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

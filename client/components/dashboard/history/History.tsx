/**
 * History.tsx
 * Used to show all of the history of the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useAttempts } from "@/lib/api/hooks/useAttempts";
import { useChats } from "@/lib/api/hooks/useChats";
import { useTrainings } from "@/lib/api/hooks/useTrainings";
import { Attempt, Training } from "@/types";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import type { Dayjs } from "dayjs";
import Link from "next/link";
import { useMemo, useState } from "react";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Extended attempt type with compiled chat information
interface AttemptWithChatInfo extends Attempt {
  training?: Partial<Training>;
  chatInfo?: {
    title: string;
    name: string;
    position: string;
    isCompleted: boolean;
    completedAt?: string;
    totalChats: number;
    completedChats: number;
  };
}

export default function History() {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  const { data: attempts, isLoading: attemptsLoading } = useAttempts();
  const { data: chats, isLoading: chatsLoading } = useChats();
  const { data: trainings, isLoading: trainingsLoading } = useTrainings();

  const isLoading = attemptsLoading || chatsLoading || trainingsLoading;

  // Compile attempt data with chat information
  const attemptsWithChatInfo = useMemo(() => {
    if (!attempts || !chats || !trainings) return [];

    return attempts.map((attempt) => {
      // Get training info
      const training = trainings.find((t) => t.id === attempt.training_id);

      // Get all chats for this attempt
      const attemptChats = chats.filter(
        (chat) => chat.attempt_id === attempt.id
      );

      // Compile chat information
      const chatInfo =
        attemptChats.length > 0
          ? {
              title: attemptChats[0]?.title || "Untitled Interview",
              name: attemptChats[0]?.name || "Unknown Candidate",
              position: attemptChats[0]?.position || "",
              isCompleted: attemptChats.every((chat) => chat.completed),
              completedAt: attemptChats.every((chat) => chat.completed)
                ? attemptChats[attemptChats.length - 1]?.completed_at
                : undefined,
              totalChats: attemptChats.length,
              completedChats: attemptChats.filter((chat) => chat.completed)
                .length,
            }
          : {
              title: "Untitled Interview",
              name: "Unknown Candidate",
              position: "",
              isCompleted: false,
              totalChats: 0,
              completedChats: 0,
            };

      return {
        ...attempt,
        training,
        chatInfo,
      };
    });
  }, [attempts, chats, trainings]);

  // Sort attempts by newest first
  const sortedAttempts = useMemo(
    () =>
      attemptsWithChatInfo.sort(
        (a, b) =>
          new Date(b.created_at || "").getTime() -
          new Date(a.created_at || "").getTime()
      ),
    [attemptsWithChatInfo]
  );

  // Filter attempts based on search and filters
  const filteredAttempts = useMemo(() => {
    return sortedAttempts.filter((attempt) => {
      // Search filter
      const matchesSearch =
        !searchText ||
        attempt.chatInfo?.title
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        attempt.chatInfo?.name
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        attempt.chatInfo?.position
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        attempt.training?.title
          ?.toLowerCase()
          .includes(searchText.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && attempt.chatInfo?.isCompleted) ||
        (statusFilter === "in-progress" && !attempt.chatInfo?.isCompleted);

      // Date range filter
      const matchesDate =
        !dateRange ||
        !dateRange[0] ||
        !dateRange[1] ||
        (attempt.created_at &&
          new Date(attempt.created_at) >= dateRange[0].toDate() &&
          attempt.created_at &&
          new Date(attempt.created_at) <= dateRange[1].toDate());

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [sortedAttempts, searchText, statusFilter, dateRange]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (startDate: string, endDate?: string) => {
    if (!endDate) return "In Progress";

    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.round(durationMs / (1000 * 60));

    return `${minutes} min`;
  };

  const getStatusTag = (attempt: AttemptWithChatInfo) => {
    if (attempt.chatInfo?.isCompleted) {
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

  const columns: ColumnsType<AttemptWithChatInfo> = [
    {
      title: "Session Details",
      dataIndex: "chatInfo",
      key: "chatInfo",
      render: (chatInfo, record: AttemptWithChatInfo) => (
        <Space direction="vertical" size={4}>
          <Text strong>{chatInfo?.title || "Untitled Interview"}</Text>
          <Space>
            <UserOutlined style={{ color: "#8c8c8c" }} />
            <Text type="secondary">
              {chatInfo?.name || "Unknown Candidate"}
            </Text>
          </Space>
          {chatInfo?.position && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {chatInfo.position}
            </Text>
          )}
          {record.training && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              Training: {record.training.title}
            </Text>
          )}
        </Space>
      ),
      width: 300,
    },
    {
      title: "Status",
      dataIndex: "chatInfo",
      key: "status",
      render: (chatInfo, record: AttemptWithChatInfo) => getStatusTag(record),
      filters: [
        { text: "Completed", value: true },
        { text: "In Progress", value: false },
      ],
      width: 130,
    },
    {
      title: "Progress",
      key: "progress",
      render: (_, record: AttemptWithChatInfo) => {
        const { totalChats, completedChats } = record.chatInfo || {
          totalChats: 0,
          completedChats: 0,
        };
        if (totalChats === 0) return <Text>No chats</Text>;

        const percentage = Math.round((completedChats / totalChats) * 100);
        return (
          <Text>
            {completedChats}/{totalChats} chats ({percentage}%)
          </Text>
        );
      },
      width: 120,
    },
    {
      title: "Duration",
      key: "duration",
      render: (_, record: AttemptWithChatInfo) => (
        <Text>
          {formatDuration(
            record.created_at || "",
            record.chatInfo?.completedAt || ""
          )}
        </Text>
      ),
      width: 100,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text>{formatDate(date)}</Text>
        </Space>
      ),
      sorter: (a: AttemptWithChatInfo, b: AttemptWithChatInfo) =>
        new Date(a.created_at || "").getTime() -
        new Date(b.created_at || "").getTime(),
      width: 180,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record: AttemptWithChatInfo) => (
        <Space>
          <Link
            href={`/dashboard/trainings/t/${record.training?.id || ""}/a/${
              record.id
            }`}
          >
            <Button type="primary" size="small" icon={<EyeOutlined />}>
              View
            </Button>
          </Link>
        </Space>
      ),
      width: 100,
    },
  ];

  const paginationConfig: TablePaginationConfig = {
    pageSize: 10,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} attempts`,
  };

  // Calculate summary stats for filtered data
  const summaryStats = useMemo(() => {
    const total = filteredAttempts.length;
    const completed = filteredAttempts.filter(
      (attempt) => attempt.chatInfo?.isCompleted
    ).length;
    const avgDuration =
      completed > 0
        ? filteredAttempts
            .filter((attempt) => attempt.chatInfo?.isCompleted)
            .reduce((acc, attempt) => {
              const start = new Date(attempt.created_at || "");
              const end = attempt.chatInfo?.completedAt
                ? new Date(attempt.chatInfo.completedAt)
                : start;
              return acc + (end.getTime() - start.getTime());
            }, 0) /
          completed /
          (1000 * 60)
        : 0;

    return { total, completed, avgDuration: Math.round(avgDuration) };
  }, [filteredAttempts]);

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>Training Session History</Title>
        <Text type="secondary" style={{ fontSize: "16px" }}>
          Review and analyze your past simulation training sessions
        </Text>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Attempts"
              value={summaryStats.total}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Completed"
              value={summaryStats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Duration"
              value={summaryStats.avgDuration}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Input
              placeholder="Search attempts..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="in-progress">In Progress</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={12}>
            <RangePicker
              style={{ width: "100%" }}
              placeholder={["Start Date", "End Date"]}
              value={dateRange}
              onChange={setDateRange}
            />
          </Col>
        </Row>
      </Card>

      {/* Attempts Table */}
      <Card>
        {filteredAttempts.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                {sortedAttempts.length === 0
                  ? "No training attempts found. Start your first simulation to see history here."
                  : "No attempts match your current filters."}
              </span>
            }
          >
            {sortedAttempts.length === 0 && (
              <Link href="/dashboard/trainings">
                <Button type="primary" icon={<PlayCircleOutlined />}>
                  Start First Simulation
                </Button>
              </Link>
            )}
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredAttempts as AttemptWithChatInfo[]}
            rowKey="id"
            loading={isLoading}
            pagination={paginationConfig}
            scroll={{ x: 800 }}
          />
        )}
      </Card>
    </div>
  );
}

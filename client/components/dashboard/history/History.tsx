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
  Table,
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
  chatType?: string | null;
  score?: number | null;
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

      // Get all chats for this attempt (assuming chats are already desc by created_at)
      const attemptChats = chats.filter(
        (chat) => chat.attempt_id === attempt.id
      );

      // latest chat for type/name/score
      const latestChat = attemptChats[0];

      // Compile chat information
      const chatInfo =
        attemptChats.length > 0
          ? {
              title: latestChat?.title || "Untitled Interview",
              name: latestChat?.name || "Unknown Candidate",
              position: latestChat?.position || "",
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

      // Determine chat type and score (if any)
      const chatType = latestChat?.training_type || null;
      const score: number | null = null;

      return {
        ...attempt,
        training,
        chatInfo,
        chatType,
        score,
      } as AttemptWithChatInfo;
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

  const columns: ColumnsType<AttemptWithChatInfo> = [
    {
      title: "Person",
      dataIndex: "chatInfo",
      key: "person",
      render: (chatInfo) => (
        <Space>
          <UserOutlined style={{ color: "#8c8c8c" }} />
          <Text>{chatInfo?.name || "Unknown Candidate"}</Text>
        </Space>
      ),
      width: 220,
    },
    {
      title: "Type",
      dataIndex: "chatType",
      key: "type",
      render: (chatType: string | null) => (
        <Text style={{ textTransform: "capitalize" }}>{chatType || "-"}</Text>
      ),
      width: 140,
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      render: (score: number | null) => (
        <Text>{typeof score === "number" ? score : "Incomplete"}</Text>
      ),
      width: 140,
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

  // Summary stats removed as requested

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>Training Session History</Title>
        <Text type="secondary" style={{ fontSize: "16px" }}>
          Review and analyze your past simulation training sessions
        </Text>
      </div>

      {/* Summary Statistics removed as requested */}

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

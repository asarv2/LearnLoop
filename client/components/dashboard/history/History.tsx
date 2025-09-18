/**
 * History.tsx
 * Used to show all of the history of the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useAttempts } from "@/lib/api/hooks/useAttempts";
import { useChats } from "@/lib/api/hooks/useChats";
import { useRubricGradesByChat } from "@/lib/api/hooks/useRubricGrades";
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
import TrainingDetailsModal from "./TrainingDetailsModal";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Helper component to display score for a chat
function ChatScore({
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
    return <Text>Incomplete</Text>;
  }

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (!grades || grades.length === 0) {
    return <Text>No score</Text>;
  }

  // Calculate average score from all rubric grades
  const totalScore = grades.reduce((sum, grade) => sum + (grade.score || 0), 0);
  const averageScore =
    grades.length > 0 ? Math.round(totalScore / grades.length) : 0;

  return <Text>{averageScore}%</Text>;
}

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
  latestChatId?: string | null;
}

export default function History() {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [trainingFilter, setTrainingFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: attempts, isLoading: attemptsLoading } = useAttempts();
  const { data: chats, isLoading: chatsLoading } = useChats();
  const { data: trainings, isLoading: trainingsLoading } = useTrainings();

  const isLoading = attemptsLoading || chatsLoading || trainingsLoading;

  const handleViewAttempt = (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAttemptId(null);
  };

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
              name: latestChat?.title || "Unknown Candidate",
              position: latestChat?.title || "",
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
      const chatType = latestChat?.title || null;
      const latestChatId = latestChat?.id || null;

      return {
        ...attempt,
        training,
        chatInfo,
        chatType,
        latestChatId,
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

      // Training filter
      const matchesTraining =
        trainingFilter === "all" || attempt.training?.title === trainingFilter;

      // Date range filter
      const matchesDate =
        !dateRange ||
        !dateRange[0] ||
        !dateRange[1] ||
        (attempt.created_at &&
          new Date(attempt.created_at) >= dateRange[0].toDate() &&
          attempt.created_at &&
          new Date(attempt.created_at) <= dateRange[1].toDate());

      return matchesSearch && matchesStatus && matchesTraining && matchesDate;
    });
  }, [sortedAttempts, searchText, statusFilter, trainingFilter, dateRange]);

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
      title: "Scenario",
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
      title: "Training",
      dataIndex: "training",
      key: "training",
      render: (training: Training | null) => (
        <Text style={{ textTransform: "capitalize" }}>
          {training?.title || "-"}
        </Text>
      ),
      width: 140,
    },
    {
      title: "Score",
      dataIndex: "latestChatId",
      key: "score",
      render: (chatId: string | null, record: AttemptWithChatInfo) => (
        <ChatScore
          chatId={chatId || ""}
          isCompleted={record.chatInfo?.isCompleted || false}
        />
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
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewAttempt(record.id)}
          >
            View
          </Button>
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
        <Title level={2}>Training Performance History</Title>
        <Text
          type="secondary"
          style={{ fontSize: "16px", marginTop: "8px", display: "block" }}
        >
          Track your progress, review completed sessions, and analyze
          performance trends across all training modules
        </Text>
      </div>

      {/* Summary Statistics removed as requested */}

      {/* Filters */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={6}>
            <Input
              placeholder="Search attempts..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={3}>
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
          <Col xs={12} md={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Training"
              value={trainingFilter}
              onChange={setTrainingFilter}
            >
              <Select.Option value="all">All Trainings</Select.Option>
              <Select.Option value="Interview">Interview</Select.Option>
              <Select.Option value="Critical Conversations">
                Critical Conversations
              </Select.Option>
              <Select.Option value="Leadership">Leadership</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={11}>
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

      {/* Training Details Modal */}
      {selectedAttemptId && (
        <TrainingDetailsModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          attemptId={selectedAttemptId}
        />
      )}
    </div>
  );
}

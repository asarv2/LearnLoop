"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import TrainingDetailsModal from "@/components/dashboard/history/TrainingDetailsModal";
import { api } from "@/lib/api/fetcher";
import { useProfile } from "@/lib/api/hooks/useProfiles";
import { useRubricGradesByChat } from "@/lib/api/hooks/useRubricGrades";
import { EyeOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
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
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useMemo, useState } from "react";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Data types
interface Attempt {
  id: string;
  training_id: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
}

// interface Chat {
//   id: string;
//   attempt_id: string;
//   title: string;
//   completed: boolean;
//   completed_at?: string;
//   created_at: string;
// }

interface Training {
  id: string;
  title: string;
  description?: string;
}

interface Profile {
  id: string;
  name: string;
  company: string;
}

interface AttemptWithDetails extends Attempt {
  training?: Training;
  profile?: Profile;
  chatInfo?: {
    title: string;
    name: string;
    isCompleted: boolean;
    completedAt?: string;
    totalChats: number;
    completedChats: number;
  };
  latestChatId?: string;
}

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

// Function to fetch company training history
async function fetchCompanyTrainingHistory(
  company: string | null
): Promise<AttemptWithDetails[]> {
  if (!company) return [];

  try {
    const response = await api<AttemptWithDetails[]>(
      `/api/v1/company-training-history?company=${encodeURIComponent(company)}`
    );
    return response;
  } catch (error) {
    console.error("Failed to fetch company training history:", error);
    return [];
  }
}

// Create columns function
const createColumns = (
  onViewAttempt: (attemptId: string) => void
): ColumnsType<AttemptWithDetails> => [
  {
    title: "Employee",
    dataIndex: "profile",
    key: "employee",
    render: (profile: Profile | undefined) => (
      <Space>
        <UserOutlined style={{ color: "#8c8c8c" }} />
        <Text style={{ fontWeight: "bold" }}>
          {profile?.name || "Unknown Employee"}
        </Text>
      </Space>
    ),
    width: 200,
  },
  {
    title: "Scenario",
    dataIndex: "chatInfo",
    key: "scenario",
    render: (chatInfo) => <Text>{chatInfo?.name || "Unknown Scenario"}</Text>,
    width: 220,
  },
  {
    title: "Training",
    dataIndex: "training",
    key: "training",
    render: (training: Training | undefined) => (
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
    render: (chatId: string | null, record: AttemptWithDetails) => (
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
    render: (date: string) => {
      const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      };
      return (
        <Space direction="vertical" size={0}>
          <Text>{formatDate(date)}</Text>
        </Space>
      );
    },
    sorter: (a: AttemptWithDetails, b: AttemptWithDetails) =>
      new Date(a.created_at || "").getTime() -
      new Date(b.created_at || "").getTime(),
    width: 180,
  },
  {
    title: "Actions",
    key: "actions",
    render: (_, record: AttemptWithDetails) => (
      <Space>
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onViewAttempt(record.id)}
        >
          View
        </Button>
      </Space>
    ),
    width: 100,
  },
];

export default function AdminHistoryPage() {
  const { user } = useAuth();
  const {
    data: currentProfile,
    isLoading: profileLoading,
    error: profileError,
  } = useProfile(user?.id || "", !!user);

  console.log("Profile loading state:", {
    user: user?.id,
    profileLoading,
    profileError,
    currentProfile,
  });

  // State for filters and modal
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

  // Fetch company training history
  const {
    data: attempts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["company-training-history", currentProfile?.company],
    queryFn: () => fetchCompanyTrainingHistory(currentProfile?.company || null),
    enabled: !!currentProfile?.company,
    staleTime: 2 * 60_000, // 2 minutes
  });

  console.log("Admin History Debug:", {
    user: user?.id,
    currentProfile: currentProfile,
    company: currentProfile?.company,
    attempts: attempts?.length,
    isLoading,
    error,
    enabled: !!currentProfile?.company,
  });

  const handleViewAttempt = (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAttemptId(null);
  };

  // Filter attempts based on search and filters
  const filteredAttempts = useMemo(() => {
    if (!attempts) return [];

    return attempts.filter((attempt) => {
      // Search filter
      const matchesSearch =
        !searchText ||
        attempt.profile?.name
          ?.toLowerCase()
          .includes(searchText.toLowerCase()) ||
        attempt.chatInfo?.title
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
          new Date(attempt.created_at) <= dateRange[1].toDate());

      return matchesSearch && matchesStatus && matchesTraining && matchesDate;
    });
  }, [attempts, searchText, statusFilter, trainingFilter, dateRange]);

  // Sort attempts by newest first
  const sortedAttempts = useMemo(
    () =>
      filteredAttempts.sort(
        (a, b) =>
          new Date(b.created_at || "").getTime() -
          new Date(a.created_at || "").getTime()
      ),
    [filteredAttempts]
  );

  const columns = createColumns(handleViewAttempt);

  // Show loading state while profile is loading
  if (profileLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <div>Loading profile...</div>
      </div>
    );
  }

  // Show error if profile failed to load
  if (profileError) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <div>Error loading profile: {profileError.message}</div>
      </div>
    );
  }

  // Show message if no company
  if (!currentProfile?.company) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <div>No company assigned to your profile.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>Company Training History</Title>
      </div>

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
        {sortedAttempts.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                {error
                  ? `Error loading data: ${error.message}`
                  : attempts?.length === 0
                  ? "No training attempts found for your company."
                  : "No attempts match your current filters."}
              </span>
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={sortedAttempts}
            rowKey="id"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} attempts`,
            }}
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

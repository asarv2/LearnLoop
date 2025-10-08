/**
 * Trainings.tsx
 * Used to show all of the trainings organized by type: Standard, Required, Custom
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import CustomTrainingModal from "@/components/training/CustomTrainingModal";
import { api } from "@/lib/api/fetcher";
import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import {
  useCustomTrainingsForUser,
  useDeleteTraining,
  useTrainingsByTypeAndCompany,
} from "@/lib/api/hooks/useTrainings";
import type { ChatCreate } from "@/lib/repos/chatRepo";
import {
  BulbOutlined,
  CalendarOutlined,
  CommentOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
  HeartOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SafetyOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  message,
  Modal,
  Row,
  Select,
  Spin,
  Tabs,
  Typography,
} from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useMemo, useState } from "react";

const { Text } = Typography;

const { Title, Paragraph } = Typography;

// Array of colors and icons for training modules
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

// Helper function to get training description from Supabase data
function getTrainingDescription(training: {
  title: string;
  description?: string | null;
}) {
  // Use database description if available
  if (training.description) {
    return training.description;
  }

  // Fallback based on title if no database description
  const title = training.title.toLowerCase();
  if (
    title.includes("difficult conversations") ||
    title.includes("critical conversations")
  ) {
    return "Master the art of navigating challenging workplace discussions with confidence. Practice delivering difficult feedback, addressing performance issues, and managing conflict resolution through realistic AI-powered scenarios that mirror real corporate situations.";
  }

  if (title.includes("interview")) {
    return "Develop advanced interviewing skills through comprehensive practice sessions. Learn to ask probing questions, assess candidates effectively, and conduct professional interviews that identify top talent while maintaining a positive candidate experience.";
  }

  if (title.includes("leadership")) {
    return "Build essential leadership capabilities through immersive training experiences. Practice decision-making, team management, strategic thinking, and employee development in scenarios designed to prepare you for senior management roles.";
  }

  return "Comprehensive professional development training designed to enhance your workplace skills and career advancement potential.";
}

// Helper component to handle training card with scenario routing
function TrainingCard({
  training,
  index,
  onEdit,
  onDelete,
  isCustom = false,
  completedTrainingIds,
}: {
  training: {
    id?: string;
    title: string;
    description?: string | null;
    active?: boolean | null;
    training_type?: string | null;
    due_date?: string | null;
    company?: string | null;
  };
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
  isCustom?: boolean;
  completedTrainingIds?: Set<string>;
}) {
  const { data: scenarios } = useScenariosByTrainingId(
    training.id || "",
    training.active || false
  );

  const color = trainingColors[index % trainingColors.length];
  const icon = trainingIcons[index % trainingIcons.length];

  // Calculate if training has multiple AI personas
  const hasMultiplePersonas = useMemo(() => {
    if (!scenarios) return false;

    const rootScenarios = scenarios.filter(
      (scenario) => scenario.parent_id === null
    );
    return rootScenarios.some(
      (scenario) => scenario.group_ids && scenario.group_ids.length > 1
    );
  }, [scenarios]);

  // Get the root scenario (parent_id = null) if available, otherwise fallback to first scenario
  const rootScenario = scenarios?.find(
    (scenario) => scenario.parent_id === null
  );
  const fallbackScenario = scenarios?.[0];
  const targetScenario = rootScenario || fallbackScenario;
  const href =
    targetScenario && targetScenario.id
      ? `/dashboard/trainings/s/${targetScenario.id}`
      : "#";

  // Determine completion/overdue status for required trainings
  const isCompleted =
    !!training.id &&
    !!completedTrainingIds &&
    completedTrainingIds.has(training.id);
  const isOverdue =
    training.training_type === "required" &&
    !!training.due_date &&
    !isCompleted &&
    new Date().getTime() > new Date(training.due_date).getTime();
  const statusLabel = isCompleted
    ? "Completed"
    : isOverdue
    ? "Overdue"
    : training.training_type === "required"
    ? "Incomplete"
    : null;
  const statusColor = isCompleted
    ? "#52c41a"
    : isOverdue
    ? "#f5222d"
    : "#fa8c16";

  return (
    <Col xs={24} sm={12} lg={8} key={training.id}>
      <Card
        hoverable={training.active || false}
        style={{
          height: "100%",
          cursor: training.active ? "pointer" : "default",
          transition: "all 0.3s ease",
          opacity: training.active ? 1 : 0.8,
          position: "relative",
        }}
      >
        {/* Status banner (top-left) for required trainings */}
        {training.training_type === "required" && statusLabel && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              left: "12px",
              zIndex: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "16px",
              backgroundColor: statusColor,
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}
          >
            {statusLabel}
          </div>
        )}

        {/* Multiple Persona Icon */}
        {hasMultiplePersonas && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: isCustom && onEdit ? "48px" : "12px",
              zIndex: 10,
            }}
          >
            <Tooltip.Provider>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: "#1890ff",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "16px",
                    }}
                  >
                    <TeamOutlined />
                  </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="TooltipContent"
                    sideOffset={5}
                    style={{
                      backgroundColor: "var(--gray-12)",
                      color: "white",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      fontSize: "14px",
                      lineHeight: "1.4",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      zIndex: 1000,
                    }}
                  >
                    Multiple AI personas
                    <Tooltip.Arrow style={{ fill: "var(--gray-12)" }} />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
        )}

        {/* Action buttons for custom trainings */}
        {isCustom && (onEdit || onDelete) && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 10,
              display: "flex",
              gap: "4px",
            }}
          >
            {onEdit && (
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                style={{
                  color: "#1890ff",
                }}
              />
            )}
            {onDelete && (
              <Button
                type="text"
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                style={{
                  color: "#ff4d4f",
                }}
              />
            )}
          </div>
        )}

        {/* Due date (top-right small) for required trainings */}
        {training.training_type === "required" && training.due_date && (
          <div
            style={{
              position: "absolute",
              top: "12px",
              // Offset if multiple personas or custom action buttons present
              right:
                hasMultiplePersonas || (isCustom && (onEdit || onDelete))
                  ? "96px"
                  : "12px",
              zIndex: 9,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <CalendarOutlined style={{ color: "#8c8c8c" }} />
            <Text type="secondary" style={{ fontSize: "12px" }}>
              Due: {new Date(training.due_date).toLocaleDateString()}
            </Text>
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "48px",
              color: color,
              marginBottom: "12px",
            }}
          >
            {icon}
          </div>
          <Title level={4} style={{ margin: 0 }}>
            {training.title}
          </Title>
        </div>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Paragraph
            type="secondary"
            style={{
              margin: 0,
              lineHeight: 1.5,
              minHeight: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {getTrainingDescription(training)}
          </Paragraph>
        </div>

        <div style={{ textAlign: "center" }}>
          {training.active ? (
            <Link href={href}>
              <Button
                type="primary"
                style={{
                  backgroundColor: color,
                  borderColor: color,
                }}
              >
                Start Training
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              style={{
                backgroundColor: color,
                borderColor: color,
              }}
            >
              Coming Soon
            </Button>
          )}
        </div>
      </Card>
    </Col>
  );
}

// Tab content component for each training type
function TrainingTabContent({
  type,
  onCreateClick,
  onEditClick,
  onDeleteClick,
}: {
  type: "standard" | "required" | "custom";
  onCreateClick?: () => void;
  onEditClick?: (training: {
    id: string;
    title: string;
    description?: string | null;
  }) => void;
  onDeleteClick?: (training: {
    id: string;
    title: string;
    description?: string | null;
  }) => void;
}) {
  const { effectiveProfile } = useAuth();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "overdue" | "incomplete" | "completed"
  >("all");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);

  // Use company-based filtering for standard and required trainings
  const {
    data: trainings,
    isLoading,
    error,
  } = useTrainingsByTypeAndCompany(type, effectiveProfile?.company || null);
  const { data: customTrainings } = useCustomTrainingsForUser(
    effectiveProfile?.id
  );

  // Fetch user's chats to determine completed trainings
  const { data: chats } = useQuery({
    queryKey: ["chats"],
    queryFn: () => api<ChatCreate[]>("/api/v1/chats"),
    staleTime: 2 * 60_000,
    enabled: !!effectiveProfile?.id,
  });

  const completedTrainingIds = useMemo(() => {
    const ids = new Set<string>();
    (chats || []).forEach((c) => {
      if (
        c.completed &&
        c.training_id &&
        c.profile_id === effectiveProfile?.id
      ) {
        ids.add(c.training_id);
      }
    });
    return ids;
  }, [chats, effectiveProfile?.id]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "16px" }}>Loading trainings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Title level={4} type="danger">
          Error loading trainings
        </Title>
        <Paragraph type="secondary">Please try again later.</Paragraph>
      </div>
    );
  }

  // Use custom trainings for custom tab, otherwise use regular trainings
  const trainingsToShow = type === "custom" ? customTrainings : trainings;

  const filteredTrainings =
    trainingsToShow
      ?.filter((training) => {
        // Only show active trainings
        return training.active === true;
      })
      .filter((training) => {
        // Date range filter on created_at (fallback to due_date)
        if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
        const start = dateRange[0];
        const end = dateRange[1];
        const createdAt = training.created_at
          ? dayjs(training.created_at)
          : training.due_date
          ? dayjs(training.due_date)
          : null;
        if (!createdAt) return true;
        return createdAt.isAfter(start) && createdAt.isBefore(end);
      })
      .filter((training) => {
        // Search filter on title/description
        if (!searchText) return true;
        const hay = `${training.title} ${
          training.description || ""
        }`.toLowerCase();
        return hay.includes(searchText.toLowerCase());
      })
      .filter((training) => {
        // Status filter (only meaningful for required)
        if (type !== "required" || statusFilter === "all") return true;
        const due = training.due_date
          ? new Date(training.due_date).getTime()
          : null;
        const now = Date.now();
        const completed =
          !!training.id && completedTrainingIds.has(training.id);
        const overdue =
          training.training_type === "required" &&
          !!due &&
          !completed &&
          now > due;
        const status = completed
          ? "completed"
          : overdue
          ? "overdue"
          : "incomplete";
        return status === statusFilter;
      }) || [];

  const sortedTrainings = filteredTrainings.sort((a, b) => {
    // Default: Overdue (0), Incomplete (1), Completed (2), others (3)
    function statusWeight(t: typeof a) {
      const due = t.due_date ? new Date(t.due_date).getTime() : null;
      const now = Date.now();
      const completed = !!t.id && completedTrainingIds.has(t.id);
      const overdue =
        t.training_type === "required" && !!due && !completed && now > due;
      if (overdue) return 0;
      if (!completed && t.training_type === "required") return 1;
      if (completed) return 2;
      return 3;
    }

    const wa = statusWeight(a);
    const wb = statusWeight(b);
    if (wa !== wb) return wa - wb;
    // Secondary: by title
    return a.title.localeCompare(b.title);
  });

  return (
    <div>
      {/* Filters/Search - only for required trainings */}
      {type === "required" && (
        <Card style={{ marginBottom: "16px" }}>
          <Row gutter={16} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="Search trainings..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Select
                style={{ width: "100%" }}
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
              >
                <Select.Option value="all">All Status</Select.Option>
                <Select.Option value="overdue">Overdue</Select.Option>
                <Select.Option value="incomplete">Incomplete</Select.Option>
                <Select.Option value="completed">Completed</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <DatePicker.RangePicker
                style={{ width: "100%" }}
                placeholder={["Start Date", "End Date"]}
                onChange={(range) => {
                  setDateRange(
                    range as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
                  );
                }}
              />
            </Col>
            <Col xs={24} sm={24} md={2}>
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  setSearchText("");
                  setStatusFilter("all");
                  setDateRange(null);
                }}
                style={{ width: "100%" }}
              >
                Clear
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      <Row gutter={[24, 24]}>
        {sortedTrainings.map((training, index) => (
          <TrainingCard
            key={training.id}
            training={training}
            index={index}
            isCustom={type === "custom"}
            completedTrainingIds={completedTrainingIds}
            onEdit={
              type === "custom" && onEditClick && training.id
                ? () =>
                    onEditClick({
                      id: training.id!,
                      title: training.title,
                      description: training.description,
                    })
                : undefined
            }
            onDelete={
              type === "custom" && onDeleteClick && training.id
                ? () =>
                    onDeleteClick({
                      id: training.id!,
                      title: training.title,
                      description: training.description,
                    })
                : undefined
            }
          />
        ))}

        {type === "custom" && (
          <Col xs={24} sm={12} lg={8}>
            <Card
              hoverable
              style={{
                height: "100%",
                cursor: "pointer",
                transition: "all 0.3s ease",
                backgroundColor: "#fafafa",
              }}
              onClick={onCreateClick}
            >
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "48px",
                    color: trainingColors[0],
                    marginBottom: "12px",
                  }}
                >
                  <PlusOutlined />
                </div>
                <Title level={4} style={{ margin: 0 }}>
                  Custom Training
                </Title>
              </div>

              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <Paragraph
                  type="secondary"
                  style={{
                    margin: 0,
                    lineHeight: 1.5,
                    minHeight: "80px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Design and deploy custom training scenarios that align with
                  your organization&apos;s specific needs, industry standards,
                  and corporate culture. Create targeted learning experiences
                  that address unique challenges and accelerate team
                  development.
                </Paragraph>
              </div>

              <div style={{ textAlign: "center" }}>
                <Button
                  type="primary"
                  style={{
                    backgroundColor: trainingColors[0],
                    borderColor: trainingColors[0],
                  }}
                >
                  Create Training
                </Button>
              </div>
            </Card>
          </Col>
        )}

        {type === "required" && sortedTrainings.length === 0 && (
          <Col span={24}>
            <Card style={{ textAlign: "center", padding: "40px" }}>
              <Title level={4} type="secondary">
                No Required Trainings
              </Title>
              <Paragraph type="secondary">
                HR has not assigned any required trainings at this time.
              </Paragraph>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}

export default function Trainings() {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingTraining, setEditingTraining] = useState<{
    id: string;
    title: string;
    description?: string | null;
  } | null>(null);
  const [deletingTraining, setDeletingTraining] = useState<{
    id: string;
    title: string;
    description?: string | null;
  } | null>(null);

  const deleteTraining = useDeleteTraining(deletingTraining?.id || "");
  const [messageApi, contextHolder] = message.useMessage();

  const handleCreateSuccess = () => {
    setCreateModalVisible(false);
    setEditingTraining(null);

    // Show success message
    messageApi.success(
      "Training created successfully! You can now start your custom training."
    );

    // The query will automatically refetch due to invalidation
  };

  const handleEditClick = (training: {
    id: string;
    title: string;
    description?: string | null;
  }) => {
    setEditingTraining(training);
    setCreateModalVisible(true);
  };

  const handleDeleteClick = (training: {
    id: string;
    title: string;
    description?: string | null;
  }) => {
    setDeletingTraining(training);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTraining) return;

    try {
      await deleteTraining.mutateAsync();
      messageApi.success(
        `Training "${deletingTraining.title}" deleted successfully!`
      );
      setDeletingTraining(null);
    } catch (error) {
      console.error("Error deleting training:", error);
      messageApi.error("Failed to delete training. Please try again.");
    }
  };

  const handleDeleteCancel = () => {
    setDeletingTraining(null);
  };

  const handleCreateClick = () => {
    setEditingTraining(null);
    setCreateModalVisible(true);
  };

  const tabItems = [
    {
      key: "standard",
      label: "Standard",
      children: <TrainingTabContent type="standard" />,
    },
    {
      key: "required",
      label: "Required",
      children: <TrainingTabContent type="required" />,
    },
    {
      key: "custom",
      label: "Custom",
      children: (
        <TrainingTabContent
          type="custom"
          onCreateClick={handleCreateClick}
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
        />
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      {/* Training Tabs */}
      <Tabs
        defaultActiveKey="standard"
        items={tabItems}
        size="large"
        tabBarStyle={{
          marginBottom: "24px",
          borderBottom: "1px solid #f0f0f0",
        }}
      />

      {/* Create Custom Training Modal */}
      <CustomTrainingModal
        visible={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingTraining(null);
        }}
        onSuccess={handleCreateSuccess}
        editingTraining={editingTraining}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete Training"
        open={!!deletingTraining}
        onOk={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        okText="Yes, Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        confirmLoading={deleteTraining.isPending}
      >
        <p>
          Are you sure you want to delete the training{" "}
          <strong>&ldquo;{deletingTraining?.title}&rdquo;</strong>? This action
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

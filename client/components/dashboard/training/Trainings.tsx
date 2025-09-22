/**
 * Trainings.tsx
 * Used to show all of the trainings organized by type: Standard, Required, Custom
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import {
  useCreateTraining,
  useCustomTrainingsForUser,
  useTrainingsByType,
  useUpdateTraining,
} from "@/lib/api/hooks/useTrainings";
import {
  BulbOutlined,
  CommentOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  HeartOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SafetyOutlined,
  TeamOutlined,
  TrophyOutlined,
  UploadOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Space,
  Spin,
  Tabs,
  Typography,
  Upload,
} from "antd";
import Link from "next/link";
import React, { useMemo, useState } from "react";

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

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
  isCustom = false,
}: {
  training: {
    id?: string;
    title: string;
    description?: string | null;
    active?: boolean | null;
  };
  index: number;
  onEdit?: () => void;
  isCustom?: boolean;
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

        {/* Edit button for custom trainings */}
        {isCustom && onEdit && (
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              zIndex: 10,
            }}
          />
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
            {!training.active && (
              <div style={{ marginTop: "8px" }}>
                <Badge count="Soon" style={{ backgroundColor: "#fa8c16" }} />
              </div>
            )}
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

// Custom Training Creation/Edit Modal
function CreateCustomTrainingModal({
  visible,
  onCancel,
  onSuccess,
  editingTraining,
}: {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  editingTraining?: {
    id: string;
    title: string;
    description?: string | null;
  } | null;
}) {
  const [form] = Form.useForm();
  const createTraining = useCreateTraining();
  const updateTraining = useUpdateTraining(editingTraining?.id || "");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (values: {
    scenario: string;
    description: string;
  }) => {
    setLoading(true);
    try {
      if (editingTraining) {
        await updateTraining.mutateAsync({
          title: values.scenario,
          description: values.description,
        });
        message.success("Custom training updated successfully!");
      } else {
        await createTraining.mutateAsync({
          title: values.scenario,
          description: values.description,
          training_type: "custom",
          practice: true,
          active: true,
          show_documents: false,
          what_to_do: [],
          what_not_to_do: [],
          user_id: user?.id,
        });
        message.success("Custom training created successfully!");
      }
      form.resetFields();
      onSuccess();
    } catch {
      message.error(
        `Failed to ${editingTraining ? "update" : "create"} custom training`
      );
    } finally {
      setLoading(false);
    }
  };

  // Set form values when editing
  React.useEffect(() => {
    if (editingTraining && visible) {
      form.setFieldsValue({
        scenario: editingTraining.title,
        description: editingTraining.description || "",
      });
    } else if (!editingTraining && visible) {
      form.resetFields();
    }
  }, [editingTraining, visible, form]);

  return (
    <Modal
      title={
        editingTraining ? "Edit Custom Training" : "Create Custom Training"
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        scrollToFirstError
      >
        <Form.Item
          name="scenario"
          label="Training Scenario"
          rules={[
            { required: true, message: "Please enter the training scenario" },
            { min: 10, message: "Please provide at least 10 characters" },
          ]}
        >
          <Input
            placeholder="e.g., Performance Review Discussion, Client Negotiation, Team Conflict Resolution"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[
            { required: true, message: "Please enter a description" },
            { min: 20, message: "Please provide at least 20 characters" },
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Describe what this training will help participants learn and practice..."
          />
        </Form.Item>

        <Form.Item name="document" label="Supporting Document (Coming Soon)">
          <Upload.Dragger disabled>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">
              Click or drag file to this area to upload
            </p>
            <p className="ant-upload-hint">
              Document upload functionality will be available soon
            </p>
          </Upload.Dragger>
        </Form.Item>

        <div style={{ textAlign: "right", marginTop: "24px" }}>
          <Space>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              icon={<PlusOutlined />}
            >
              {editingTraining ? "Update Training" : "Create Training"}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}

// Tab content component for each training type
function TrainingTabContent({
  type,
  onCreateClick,
  onEditClick,
}: {
  type: "standard" | "required" | "custom";
  onCreateClick?: () => void;
  onEditClick?: (training: {
    id: string;
    title: string;
    description?: string | null;
  }) => void;
}) {
  const { user } = useAuth();
  const { data: trainings, isLoading, error } = useTrainingsByType(type);
  const { data: customTrainings } = useCustomTrainingsForUser(user?.id);

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
    trainingsToShow?.filter((training) => {
      // Only show active trainings
      return training.active === true;
    }) || [];

  const sortedTrainings = filteredTrainings.sort((a, b) => {
    // Sort alphabetically by title
    return a.title.localeCompare(b.title);
  });

  return (
    <div>
      <Row gutter={[24, 24]}>
        {sortedTrainings.map((training, index) => (
          <TrainingCard
            key={training.id}
            training={training}
            index={index}
            isCustom={type === "custom"}
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

  const handleCreateSuccess = () => {
    setCreateModalVisible(false);
    setEditingTraining(null);
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
        />
      ),
    },
  ];

  return (
    <div>
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
      <CreateCustomTrainingModal
        visible={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingTraining(null);
        }}
        onSuccess={handleCreateSuccess}
        editingTraining={editingTraining}
      />
    </div>
  );
}

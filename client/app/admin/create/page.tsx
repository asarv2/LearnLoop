"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { useProfile } from "@/lib/api/hooks/useProfiles";
import { trainingKeys } from "@/lib/api/keys";
import {
  CalendarOutlined,
  FileTextOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";

const { Title, Text } = Typography;
const { TextArea } = Input;

type Policy = {
  id: string;
  title: string;
  description: string | null;
  file_key: string | null;
  created_at: string | null;
  company: string;
};

export default function AdminCreatePage() {
  const [form] = Form.useForm();
  const [loading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState({
    visible: false,
    type: "",
    message: "",
    progress: 0,
  });
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  const { user } = useAuth();
  const { data: currentProfile } = useProfile(user?.id || "", !!user);
  const { emitCreateTraining } = useWebSocket();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  // Fetch policies on component mount
  useEffect(() => {
    const fetchPolicies = async () => {
      setLoadingPolicies(true);
      try {
        const res = await fetch("/api/v1/policies", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data)) {
          setPolicies(data as Policy[]);
        }
      } catch (error) {
        console.error("Error fetching policies:", error);
        messageApi.error("Failed to load policies");
      } finally {
        setLoadingPolicies(false);
      }
    };

    fetchPolicies();
  }, [messageApi]);

  // Listen for training creation progress events
  React.useEffect(() => {
    const handleProgress = (e: CustomEvent) => {
      const data = e.detail || {};
      setProgress({
        visible: true,
        type: data.type || "",
        message: data.message || "",
        progress: data.progress || 0,
      });
    };

    const handleCompleted = (e: CustomEvent) => {
      const data = e.detail || {};
      if (data.success) {
        setProgress({
          visible: false,
          type: "",
          message: "",
          progress: 0,
        });
        setIsCreating(false);
        form.resetFields();

        // Invalidate queries to refresh the training list
        queryClient.invalidateQueries({ queryKey: trainingKeys.all });

        messageApi.success(
          "Required training created successfully! It will now appear for employees in your company."
        );
      } else {
        setIsCreating(false);
        setProgress({
          visible: false,
          type: "",
          message: "",
          progress: 0,
        });
        messageApi.error(
          data.error || "Failed to create training. Please try again."
        );
      }
    };

    window.addEventListener(
      "trainingCreationProgress",
      handleProgress as EventListener
    );
    window.addEventListener(
      "trainingCreationCompleted",
      handleCompleted as EventListener
    );

    return () => {
      window.removeEventListener(
        "trainingCreationProgress",
        handleProgress as EventListener
      );
      window.removeEventListener(
        "trainingCreationCompleted",
        handleCompleted as EventListener
      );
    };
  }, [form, messageApi, queryClient]);

  const handleSubmit = async (values: {
    title: string;
    description: string;
    dueDate?: dayjs.Dayjs;
    policyId?: string;
  }) => {
    if (!currentProfile?.company) {
      messageApi.error(
        "You must be assigned to a company to create trainings."
      );
      return;
    }

    setIsCreating(true);
    setProgress({
      visible: true,
      type: "generating_training",
      message: "Creating required training...",
      progress: 0,
    });

    try {
      // Create the training using WebSocket with policy reference
      emitCreateTraining({
        name: values.title,
        description: values.description,
        policy_id: values.policyId,
        profile_id: user?.id,
        // Additional data for admin-created required trainings
        training_type: "required",
        company: currentProfile.company,
        due_date: values.dueDate ? values.dueDate.toISOString() : undefined,
        admin_created: true,
      });
    } catch (error) {
      console.error("Error in training creation:", error);
      messageApi.error("Failed to create training. Please try again.");
      setIsCreating(false);
      setProgress({
        visible: false,
        type: "",
        message: "",
        progress: 0,
      });
    }
  };

  return (
    <div>
      {contextHolder}
      <Title level={2} style={{ marginBottom: "24px" }}>
        Create Required Training
      </Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title="Required Training Creation"
            style={{ marginBottom: "24px" }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              scrollToFirstError
            >
              <Form.Item
                name="title"
                label="Training Title"
                rules={[
                  {
                    required: true,
                    message: "Please enter the training title",
                  },
                  { min: 10, message: "Please provide at least 10 characters" },
                ]}
              >
                <Input
                  placeholder="e.g., Annual Compliance Training, Safety Procedures, Customer Service Excellence"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="description"
                label="Training Description"
                rules={[
                  { required: true, message: "Please enter a description" },
                  { min: 20, message: "Please provide at least 20 characters" },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Describe what this training will cover and what employees will learn..."
                />
              </Form.Item>

              <Form.Item
                name="dueDate"
                label="Due Date (Optional)"
                tooltip="Set a deadline for when employees should complete this training"
              >
                <DatePicker
                  size="large"
                  style={{ width: "100%" }}
                  placeholder="Select due date"
                  disabledDate={(current) =>
                    current && current < dayjs().endOf("day")
                  }
                  showTime={{ format: "HH:mm" }}
                  format="YYYY-MM-DD HH:mm"
                  suffixIcon={<CalendarOutlined />}
                />
              </Form.Item>

              <Form.Item
                name="policyId"
                label="Supporting Policy (Optional)"
                tooltip="Select a company policy to include with this training"
              >
                <Select
                  placeholder="Select a policy..."
                  allowClear
                  loading={loadingPolicies}
                  size="large"
                  suffixIcon={<FileTextOutlined />}
                  notFoundContent={
                    policies.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px" }}>
                        <FileTextOutlined
                          style={{
                            fontSize: "24px",
                            color: "#d9d9d9",
                            marginBottom: "8px",
                          }}
                        />
                        <div style={{ color: "#8c8c8c" }}>
                          No policies uploaded yet
                        </div>
                        <div
                          style={{
                            color: "#bfbfbf",
                            fontSize: "12px",
                            marginTop: "4px",
                          }}
                        >
                          Upload policies in the Documents section first
                        </div>
                      </div>
                    ) : (
                      "No policies found"
                    )
                  }
                >
                  {policies.map((policy) => (
                    <Select.Option key={policy.id} value={policy.id}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{policy.title}</div>
                        {policy.description && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#8c8c8c",
                              marginTop: "2px",
                            }}
                          >
                            {policy.description.length > 60
                              ? `${policy.description.substring(0, 60)}...`
                              : policy.description}
                          </div>
                        )}
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Progress Display */}
              {progress.visible && (
                <div style={{ marginTop: "16px", marginBottom: "16px" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <Text strong>{progress.message}</Text>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      backgroundColor: "#f0f0f0",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress.progress}%`,
                        height: "100%",
                        backgroundColor: "#1890ff",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <div style={{ textAlign: "right", marginTop: "4px" }}>
                    <Text type="secondary">{progress.progress}%</Text>
                  </div>
                </div>
              )}

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading || isCreating}
                    icon={<PlusOutlined />}
                    size="large"
                  >
                    Create Required Training
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Training Information" style={{ marginBottom: "24px" }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text strong>Training Type:</Text>
                <div style={{ marginTop: "4px" }}>
                  <Text type="secondary">Required Training</Text>
                </div>
              </div>
              <div>
                <Text strong>Visibility:</Text>
                <div style={{ marginTop: "4px" }}>
                  <Text type="secondary">
                    {currentProfile?.company
                      ? `Only employees in ${currentProfile.company}`
                      : "No company assigned"}
                  </Text>
                </div>
              </div>
              <div>
                <Text strong>Assignment:</Text>
                <div style={{ marginTop: "4px" }}>
                  <Text type="secondary">
                    Automatically assigned to all company employees
                  </Text>
                </div>
              </div>
            </Space>
          </Card>

          <Card title="Guidelines">
            <Space direction="vertical" size="small">
              <Text strong>Best Practices:</Text>
              <ul style={{ margin: 0, paddingLeft: "20px" }}>
                <li>
                  <Text type="secondary">Use clear, descriptive titles</Text>
                </li>
                <li>
                  <Text type="secondary">
                    Provide detailed learning objectives
                  </Text>
                </li>
                <li>
                  <Text type="secondary">Set realistic due dates</Text>
                </li>
                <li>
                  <Text type="secondary">
                    Include supporting policies when needed
                  </Text>
                </li>
              </ul>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

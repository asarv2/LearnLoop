"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import FilePreviewModal from "@/components/chat/FilePreviewModal";
import { useWebSocket } from "@/contexts/websocket-context";
import {
  uploadDocument,
  useCreateDocument,
} from "@/lib/api/hooks/useDocuments";
import { useProfile } from "@/lib/api/hooks/useProfiles";
import { trainingKeys } from "@/lib/api/keys";
import {
  CalendarOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  UploadOutlined,
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
  Space,
  Typography,
  Upload,
} from "antd";
import dayjs from "dayjs";
import React, { useState } from "react";

const { Title, Text } = Typography;
const { TextArea } = Input;

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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentPreviewVisible, setDocumentPreviewVisible] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(
    null
  );

  const { user } = useAuth();
  const { data: currentProfile } = useProfile(user?.id || "", !!user);
  const { emitCreateTraining } = useWebSocket();
  const createDocument = useCreateDocument();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

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
        setUploadedFile(null);
        setUploadedDocumentId(null);

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
      let documentId: string | undefined;

      // Upload document if one was selected
      if (uploadedFile) {
        try {
          setProgress({
            visible: true,
            type: "generating_training",
            message: "Uploading document...",
            progress: 10,
          });

          const document = await createDocument.mutateAsync({
            content: "",
            profile_id: user?.id || null,
            title: uploadedFile.name,
          });

          const formData = new FormData();
          formData.append("file", uploadedFile);
          await uploadDocument(document.id!, formData);

          documentId = document.id!;
          setUploadedDocumentId(document.id!);

          setProgress({
            visible: true,
            type: "generating_training",
            message: "Document uploaded, creating training...",
            progress: 30,
          });
        } catch (error) {
          console.error("Error uploading document:", error);
          messageApi.error("Failed to upload document. Please try again.");
          setIsCreating(false);
          setProgress({
            visible: false,
            type: "",
            message: "",
            progress: 0,
          });
          return;
        }
      }

      // Create the training using WebSocket with additional metadata for admin creation
      emitCreateTraining({
        name: values.title,
        description: values.description,
        document_id: documentId,
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

              <Form.Item name="document" label="Supporting Document (Optional)">
                <div>
                  <Upload.Dragger
                    beforeUpload={(file) => {
                      // Validate file type
                      if (file.type !== "application/pdf") {
                        messageApi.error("Only PDF files are supported");
                        return false;
                      }
                      setUploadedFile(file);
                      return false; // Prevent auto upload
                    }}
                    onRemove={() => {
                      setUploadedFile(null);
                      setUploadedDocumentId(null);
                    }}
                    fileList={
                      uploadedFile
                        ? [
                            {
                              uid: "1",
                              name: uploadedFile.name,
                              status: "done",
                            },
                          ]
                        : []
                    }
                    maxCount={1}
                    accept=".pdf"
                    itemRender={(originNode, file) => {
                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginTop: "12px",
                            padding: "8px 12px",
                            backgroundColor: "#fafafa",
                            borderRadius: "6px",
                            border: "1px solid #d9d9d9",
                          }}
                        >
                          <span style={{ flex: 1 }}>{file.name}</span>
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => setDocumentPreviewVisible(true)}
                            style={{ color: "#1890ff", padding: "4px" }}
                            title="Preview Document"
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              setUploadedFile(null);
                              setUploadedDocumentId(null);
                            }}
                            style={{ color: "#ff4d4f", padding: "4px" }}
                            title="Remove Document"
                          />
                        </div>
                      );
                    }}
                  >
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">
                      Click or drag PDF file to this area to upload
                    </p>
                    <p className="ant-upload-hint">
                      Optional: Add a supporting document for this training
                    </p>
                  </Upload.Dragger>
                </div>
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
                    Include supporting materials when needed
                  </Text>
                </li>
              </ul>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Document Preview Modal */}
      <FilePreviewModal
        isOpen={documentPreviewVisible}
        onClose={() => setDocumentPreviewVisible(false)}
        file={uploadedFile || undefined}
        documentId={uploadedDocumentId || undefined}
      />
    </div>
  );
}

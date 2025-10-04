"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import FilePreviewModal from "@/components/chat/FilePreviewModal";
import { useWebSocket } from "@/contexts/websocket-context";
import { api } from "@/lib/api/fetcher";
import {
  uploadDocument,
  useCreateDocument,
} from "@/lib/api/hooks/useDocuments";
import { useGroup } from "@/lib/api/hooks/useGroups";
import { useParametersByField } from "@/lib/api/hooks/useParameters";
import { trainingKeys } from "@/lib/api/keys";
import type { Rubric } from "@/types";
import {
  CalendarOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
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
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Typography,
  Upload,
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

interface TrainingComponentProps {
  // Mode configuration
  custom?: boolean; // Default: false (for required trainings)
  training_id?: string; // If provided, enables edit mode

  // UI configuration
  asModal?: boolean; // Whether to render as modal or inline form
  visible?: boolean; // For modal usage
  title?: string; // Custom title override
  showGuidelines?: boolean; // Whether to show the guidelines sidebar

  // Callbacks
  onSuccess?: () => void; // Callback when training is created/updated successfully
  onCancel?: () => void; // Callback when creation/editing is cancelled

  // For editing existing trainings
  editingTraining?: {
    id: string;
    title: string;
    description?: string | null;
    training_type?: string | null;
    active?: boolean | null;
    due_date?: string | null;
  } | null;
}

export default function TrainingComponent({
  custom = false,
  training_id,
  asModal = false,
  visible = true,
  title,
  showGuidelines = true,
  onSuccess,
  onCancel,
  editingTraining = null,
}: TrainingComponentProps) {
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
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [scenarios, setScenarios] = useState<
    Array<{
      id: string;
      title: string;
      parent_id: string | null;
      policy_ids: string[];
      training_id: string | null;
    }>
  >([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  // Document upload state for custom mode
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentPreviewVisible, setDocumentPreviewVisible] = useState(false);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(
    null
  );

  const { effectiveProfile } = useAuth();
  const { emitCreateTraining } = useWebSocket();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const createDocument = useCreateDocument();

  // Determine if we're in edit mode
  const isEditMode = !!(training_id || editingTraining?.id);
  const currentTraining = editingTraining;

  // Fetch the general group to get mood_field_id
  const generalGroupId = "8b6ed9ac-bfb7-4f31-992b-73935f6560bf";
  const { data: generalGroup, isLoading: loadingGroup } =
    useGroup(generalGroupId);

  // Fetch mood parameters using the mood_field_id from the group
  const { data: moodParameters, isLoading: loadingMoodParameters } =
    useParametersByField(
      generalGroup?.mood_field_id || "",
      !!generalGroup?.mood_field_id
    );

  // Fetch policies and rubrics on component mount (only for required mode)
  useEffect(() => {
    if (!custom) {
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
    }

    // Fetch scenarios for edit mode to get existing policy_ids
    if (isEditMode && training_id) {
      const fetchScenarios = async () => {
        setLoadingScenarios(true);
        try {
          const res = await fetch(
            `/api/v1/scenarios?training_id=${training_id}`,
            { cache: "no-store" }
          );
          const data = await res.json();
          if (Array.isArray(data)) {
            setScenarios(data);
          }
        } catch (error) {
          console.error("Error fetching scenarios:", error);
          messageApi.error("Failed to load scenarios");
        } finally {
          setLoadingScenarios(false);
        }
      };

      fetchScenarios();
    }

    const fetchRubrics = async () => {
      setLoadingRubrics(true);
      try {
        const res = await fetch("/api/v1/rubrics", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data)) {
          setRubrics(data);
        }
      } catch (error) {
        console.error("Error fetching rubrics:", error);
        messageApi.error("Failed to load rubrics");
      } finally {
        setLoadingRubrics(false);
      }
    };

    fetchRubrics();
  }, [custom, messageApi, isEditMode, training_id]);

  // Set form values when in edit mode
  useEffect(() => {
    if (isEditMode && currentTraining && visible) {
      // Get the first policy_id from scenarios for prefill
      const firstScenario = scenarios.find((s) => s.parent_id === null);
      const firstPolicyId = firstScenario?.policy_ids?.[0] || null;

      form.setFieldsValue({
        title: currentTraining.title || "",
        scenario: currentTraining.title || "", // For custom trainings
        description: currentTraining.description || "",
        active: currentTraining.active ?? true,
        training_type:
          currentTraining.training_type || (custom ? "custom" : "required"),
        due_date: currentTraining.due_date
          ? dayjs(currentTraining.due_date)
          : null,
        policyId: firstPolicyId, // Prefill with first policy from scenarios
      });
    } else if (!visible) {
      form.resetFields();
      setUploadedFile(null);
      setUploadedDocumentId(null);
    }
  }, [isEditMode, currentTraining, visible, custom, form, scenarios]);

  // Listen for training creation progress events (only for creation mode)
  React.useEffect(() => {
    if (isEditMode) return; // Don't listen for creation events in edit mode

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

        const successMessage = custom
          ? "Custom training created successfully!"
          : "Required training created successfully! It will now appear for employees in your company.";

        messageApi.success(successMessage);

        if (onSuccess) {
          onSuccess();
        }
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
  }, [form, messageApi, queryClient, custom, onSuccess, isEditMode]);

  // Handle document upload for custom mode
  const handleDocumentUpload = async (file: File) => {
    try {
      // 1) First create the document record using the hook
      const document = await createDocument.mutateAsync({
        title: file.name,
        content: null, // Will be populated when file is uploaded
        profile_id: effectiveProfile?.id || null,
      });

      // 2) Then upload the file using the uploadDocument function
      const formData = new FormData();
      formData.append("file", file);
      await uploadDocument(document.id!, formData);

      setUploadedDocumentId(document.id!);
      setUploadedFile(file);
      messageApi.success("Document uploaded successfully");
      return false; // Prevent default upload behavior
    } catch (error) {
      console.error("Error uploading document:", error);
      messageApi.error("Failed to upload document");
      return false;
    }
  };

  const handleDocumentRemove = () => {
    setUploadedFile(null);
    setUploadedDocumentId(null);
    messageApi.info("Document removed");
  };

  const handleSubmit = async (values: {
    title?: string;
    scenario?: string;
    description: string;
    dueDate?: dayjs.Dayjs;
    policyId?: string;
    moods?: string[];
    rubricId?: string;
    active?: boolean;
    training_type?: string;
    due_date?: dayjs.Dayjs;
  }) => {
    if (!effectiveProfile?.company) {
      messageApi.error(
        "You must be assigned to a company to create trainings."
      );
      return;
    }

    if (isEditMode) {
      // Handle editing existing training
      const trainingId = training_id || currentTraining?.id;
      if (!trainingId) return;

      setIsCreating(true);
      try {
        // Update the training
        await api(`/api/v1/trainings/${trainingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: custom ? values.scenario : values.title,
            description: values.description || null,
            active: values.active,
            training_type: values.training_type,
            due_date: values.due_date ? values.due_date.toISOString() : null,
          }),
        });

        // Update scenarios with the policy_id if provided
        if (values.policyId) {
          // Get all parent scenarios (parent_id is null) for this training
          const parentScenarios = scenarios.filter((s) => s.parent_id === null);

          // Update each parent scenario with the policy_id
          for (const scenario of parentScenarios) {
            await api(`/api/v1/scenarios/${scenario.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                policy_ids: [values.policyId],
              }),
            });
          }
        }

        messageApi.success("Training updated successfully");
        queryClient.invalidateQueries({ queryKey: ["trainings"] });
        queryClient.invalidateQueries({ queryKey: ["training-completion"] });
        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        console.error("Error updating training:", error);
        messageApi.error("Failed to update training");
      } finally {
        setIsCreating(false);
      }
    } else {
      // Handle creating new training
      setIsCreating(true);
      setProgress({
        visible: true,
        type: "generating_training",
        message: custom
          ? "Creating custom training..."
          : "Creating required training...",
        progress: 0,
      });

      try {
        // Create the training using WebSocket
        emitCreateTraining({
          name: (custom ? values.scenario : values.title) || "",
          description: values.description,
          document_id: custom ? uploadedDocumentId || undefined : undefined,
          policy_id: custom ? undefined : values.policyId,
          mood_parameters: values.moods || [],
          rubric_id: values.rubricId,
          profile_id: effectiveProfile?.id,
          training_type: custom ? "custom" : "required",
          company: effectiveProfile.company,
          due_date: custom
            ? undefined
            : values.dueDate
            ? values.dueDate.toISOString()
            : undefined,
          admin_created: !custom,
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
    }
  };

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      scrollToFirstError
    >
      <Form.Item
        name={custom ? "scenario" : "title"}
        label={custom ? "Training Scenario" : "Training Title"}
        rules={[
          {
            required: true,
            message: custom
              ? "Please enter the training scenario"
              : "Please enter the training title",
          },
          { min: 10, message: "Please provide at least 10 characters" },
        ]}
      >
        <Input
          placeholder={
            custom
              ? "e.g., Performance Review Discussion, Client Negotiation, Team Conflict Resolution"
              : "e.g., Annual Compliance Training, Safety Procedures, Customer Service Excellence"
          }
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

      {/* Training Type (only in edit mode) */}
      {isEditMode && (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="training_type" label="Type">
              <Select
                options={[
                  { label: "Standard", value: "standard" },
                  { label: "Required", value: "required" },
                  { label: "Custom", value: "custom" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="due_date" label="Due Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
      )}

      {!custom && !isEditMode && (
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
      )}

      {custom ? (
        // Document upload for custom mode
        <Form.Item
          name="document"
          label="Training Document (Optional)"
          tooltip="Upload a document to provide context for the training scenario"
        >
          <div>
            {uploadedFile ? (
              <div
                style={{
                  border: "1px solid #d9d9d9",
                  borderRadius: "6px",
                  padding: "12px",
                  backgroundColor: "#fafafa",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <FileTextOutlined />
                    <Text>{uploadedFile.name}</Text>
                  </div>
                  <Space>
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => setDocumentPreviewVisible(true)}
                      size="small"
                    >
                      Preview
                    </Button>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDocumentRemove}
                      size="small"
                    >
                      Remove
                    </Button>
                  </Space>
                </div>
              </div>
            ) : (
              <Upload.Dragger
                beforeUpload={(file) => {
                  const isPDF = file.type === "application/pdf";
                  if (!isPDF) {
                    messageApi.error("Only PDF files are supported!");
                    return false;
                  }
                  return handleDocumentUpload(file);
                }}
                accept=".pdf"
                multiple={false}
                showUploadList={false}
                style={{
                  border: "1px dashed #d9d9d9",
                  borderRadius: "6px",
                }}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined
                    style={{ fontSize: "24px", color: "#1890ff" }}
                  />
                </p>
                <p className="ant-upload-text">
                  Click or drag PDF file to upload
                </p>
                <p className="ant-upload-hint">Only PDF files are supported</p>
              </Upload.Dragger>
            )}
          </div>
        </Form.Item>
      ) : (
        // Policy selection for required mode (show in both creation and edit mode)
        <Form.Item
          name="policyId"
          label="Supporting Policy (Optional)"
          tooltip="Select a company policy to include with this training"
        >
          <Select
            placeholder="Select a policy..."
            allowClear
            loading={loadingPolicies || loadingScenarios}
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
      )}

      {/* Moods field (only for creation mode) */}
      {!isEditMode && (
        <Form.Item
          name="moods"
          label="Moods (Select 4)"
          tooltip="Choose 4 moods that will be randomly assigned to different personas in the training scenarios"
          rules={[
            {
              validator: (_, value) => {
                if (!value || value.length === 0) {
                  return Promise.resolve();
                }
                if (value.length !== 4) {
                  return Promise.reject(
                    new Error("Please select exactly 4 moods")
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Select
            mode="multiple"
            placeholder="Select 4 moods..."
            maxCount={4}
            size="large"
            style={{ width: "100%" }}
            loading={loadingGroup || loadingMoodParameters}
            options={
              moodParameters
                ?.filter((param) => param.value !== null) // Filter out custom option
                ?.map((param) => ({
                  value: param.id, // Store parameter ID instead of value
                  label: param.name,
                })) || []
            }
          />
        </Form.Item>
      )}

      {/* Rubric field (only for creation mode) */}
      {!isEditMode && (
        <Form.Item
          name="rubricId"
          label="Rubric"
          tooltip="Select a rubric to evaluate training performance"
          rules={[{ required: true, message: "Please select a rubric" }]}
        >
          <Select
            placeholder="Select a rubric..."
            loading={loadingRubrics}
            size="large"
            style={{ width: "100%" }}
            optionLabelProp="label"
            notFoundContent={
              rubrics.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div style={{ color: "#8c8c8c" }}>No rubrics available</div>
                </div>
              ) : (
                "No rubrics found"
              )
            }
          >
            {/* General rubric (generic) */}
            {rubrics
              .filter(
                (rubric) =>
                  !rubric.company && rubric.name.toLowerCase() === "general"
              )
              .map((rubric) => (
                <Select.Option
                  key={rubric.id}
                  value={rubric.id}
                  label={rubric.name}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{rubric.name}</div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#8c8c8c",
                        marginTop: "2px",
                      }}
                    >
                      Generic Rubric
                    </div>
                  </div>
                </Select.Option>
              ))}

            {/* Company-specific rubrics */}
            {rubrics
              .filter((rubric) => rubric.company === effectiveProfile?.company)
              .map((rubric) => (
                <Select.Option
                  key={rubric.id}
                  value={rubric.id}
                  label={rubric.name}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{rubric.name}</div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#8c8c8c",
                        marginTop: "2px",
                      }}
                    >
                      Company Rubric
                    </div>
                  </div>
                </Select.Option>
              ))}
          </Select>
        </Form.Item>
      )}

      {/* Active switch (only for edit mode and non-custom trainings) */}
      {isEditMode && currentTraining?.training_type !== "custom" && (
        <Form.Item name="active" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      )}

      {/* Progress Display (only for creation mode) */}
      {!isEditMode && progress.visible && (
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
            {isEditMode
              ? "Save Changes"
              : custom
              ? "Create Custom Training"
              : "Create Required Training"}
          </Button>
          {asModal && <Button onClick={onCancel}>Cancel</Button>}
        </Space>
      </Form.Item>
    </Form>
  );

  const guidelinesContent = (
    <>
      <Card title="Training Information" style={{ marginBottom: "24px" }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text strong>Training Type:</Text>
            <div style={{ marginTop: "4px" }}>
              <Text type="secondary">
                {custom ? "Custom Training" : "Required Training"}
              </Text>
            </div>
          </div>
          <div>
            <Text strong>Visibility:</Text>
            <div style={{ marginTop: "4px" }}>
              <Text type="secondary">
                {effectiveProfile?.company
                  ? `Only employees in ${effectiveProfile.company}`
                  : "No company assigned"}
              </Text>
            </div>
          </div>
          <div>
            <Text strong>Assignment:</Text>
            <div style={{ marginTop: "4px" }}>
              <Text type="secondary">
                {custom
                  ? "Personal training for your practice"
                  : "Automatically assigned to all company employees"}
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
              <Text type="secondary">Provide detailed learning objectives</Text>
            </li>
            {!custom && (
              <li>
                <Text type="secondary">Set realistic due dates</Text>
              </li>
            )}
            {custom ? (
              <li>
                <Text type="secondary">
                  Upload relevant documents for context
                </Text>
              </li>
            ) : (
              <li>
                <Text type="secondary">
                  Include supporting policies when needed
                </Text>
              </li>
            )}
          </ul>
        </Space>
      </Card>
    </>
  );

  // If rendering as modal
  if (asModal) {
    return (
      <Modal
        title={
          title ||
          (isEditMode
            ? "Edit Training"
            : custom
            ? "Create Custom Training"
            : "Create Required Training")
        }
        open={visible}
        onCancel={onCancel}
        footer={null}
        width={800}
        destroyOnClose
      >
        {contextHolder}
        {formContent}
      </Modal>
    );
  }

  // Default inline layout
  return (
    <div>
      {contextHolder}
      <Title level={2} style={{ marginBottom: "24px" }}>
        {title ||
          (isEditMode
            ? "Edit Training"
            : custom
            ? "Create Custom Training"
            : "Create Required Training")}
      </Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={showGuidelines ? 16 : 24}>
          <Card
            title={
              isEditMode
                ? "Edit Training"
                : `${custom ? "Custom" : "Required"} Training Creation`
            }
            style={{ marginBottom: "24px" }}
          >
            {formContent}
          </Card>
        </Col>

        {showGuidelines && (
          <Col xs={24} lg={8}>
            {guidelinesContent}
          </Col>
        )}
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

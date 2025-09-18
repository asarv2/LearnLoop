"use client";

import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FormOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useState } from "react";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Mock data for user's submitted requests
const userRequestsData = [
  {
    key: "1",
    id: "REQ001",
    trainingType: "Technical Leadership",
    targetAudience: "Engineering Team",
    priority: "High",
    status: "Pending",
    submittedDate: "2024-01-15",
    requestedDate: "2024-02-01",
    estimatedCost: "$2,500",
    participants: 8,
  },
];

const columns = [
  { title: "ID", dataIndex: "id", key: "id", width: 80 },
  {
    title: "Training Type",
    dataIndex: "trainingType",
    key: "trainingType",
    render: (trainingType: string) => <Tag color="blue">{trainingType}</Tag>,
  },
  {
    title: "Priority",
    dataIndex: "priority",
    key: "priority",
    render: (priority: string) => (
      <Tag
        color={
          priority === "High"
            ? "red"
            : priority === "Medium"
            ? "orange"
            : "green"
        }
      >
        {priority}
      </Tag>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Space>
        {status === "Pending" || status === "In Review" ? (
          <ClockCircleOutlined />
        ) : null}
        {status === "Approved" ? <CheckCircleOutlined /> : null}
        {status === "Rejected" ? <CloseCircleOutlined /> : null}
        <Tag
          color={
            status === "Pending"
              ? "blue"
              : status === "Approved"
              ? "green"
              : status === "Rejected"
              ? "red"
              : "orange"
          }
        >
          {status}
        </Tag>
      </Space>
    ),
  },
  {
    title: "Participants",
    dataIndex: "participants",
    key: "participants",
    render: (participants: number) => <Text strong>{participants} people</Text>,
  },
  {
    title: "Submitted",
    dataIndex: "submittedDate",
    key: "submittedDate",
    render: (date: string) => (
      <Space>
        <CalendarOutlined />
        {date}
      </Space>
    ),
  },
];

const trainingTypes = [
  "Technical Leadership",
  "Digital Marketing Analytics",
  "Advanced Negotiation Skills",
  "Diversity & Inclusion Leadership",
  "Process Optimization",
  "Project Management",
  "Data Analysis",
  "Customer Service Excellence",
  "Financial Management",
  "Communication Skills",
  "Other",
];

const priorityOptions = [
  { value: "High", label: "High - Urgent business need", color: "red" },
  {
    value: "Medium",
    label: "Medium - Important for team development",
    color: "orange",
  },
  { value: "Low", label: "Low - Nice to have", color: "green" },
];

export default function EmployeeRequestsPage() {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      message.success("Training request submitted successfully!");
      setModalVisible(false);
      form.resetFields();
      setCurrentStep(0);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    {
      title: "Training Details",
      description: "Basic information about the training",
    },
    {
      title: "Business Justification",
      description: "Why this training is needed",
    },
    {
      title: "Review & Submit",
      description: "Review your request before submitting",
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title
          level={2}
          style={{ margin: 0, display: "flex", alignItems: "center" }}
        >
          <FormOutlined style={{ marginRight: "12px", color: "#1890ff" }} />
          Training Requests
        </Title>
        <Text type="secondary">
          Submit requests for new training programs and track status
        </Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => setModalVisible(true)}
          >
            Submit New Request
          </Button>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: "16px" }}>
          <Title level={4} style={{ margin: 0 }}>
            My Training Requests ({userRequestsData.length})
          </Title>
        </div>
        <Table
          columns={columns}
          dataSource={userRequestsData}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Submit Training Request"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Steps current={currentStep} style={{ marginBottom: "24px" }}>
          {steps.map((s) => (
            <Steps.Step
              key={s.title}
              title={s.title}
              description={s.description}
            />
          ))}
        </Steps>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          scrollToFirstError
        >
          {currentStep === 0 && (
            <div>
              <Title level={4}>Training Information</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="trainingType"
                    label="Training Type"
                    rules={[
                      {
                        required: true,
                        message: "Please select a training type",
                      },
                    ]}
                  >
                    <Select placeholder="Select training type" size="large">
                      {trainingTypes.map((t) => (
                        <Option key={t} value={t}>
                          {t}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="targetAudience"
                    label="Target Audience"
                    rules={[
                      {
                        required: true,
                        message: "Please specify the target audience",
                      },
                    ]}
                  >
                    <Input placeholder="e.g., Engineering Team, Sales Team, All Employees" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="participants"
                    label="Number of Participants"
                    rules={[
                      {
                        required: true,
                        message: "Please enter number of participants",
                      },
                    ]}
                  >
                    <Input
                      type="number"
                      placeholder="How many people will attend?"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="requestedDate"
                    label="Preferred Training Date"
                    rules={[
                      {
                        required: true,
                        message: "Please select a preferred date",
                      },
                    ]}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="priority"
                label="Priority Level"
                rules={[
                  { required: true, message: "Please select priority level" },
                ]}
              >
                <Select placeholder="Select priority level" size="large">
                  {priorityOptions.map((p) => (
                    <Option key={p.value} value={p.value}>
                      <Space>
                        <Tag color={p.color}>{p.value}</Tag>
                        {p.label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <Title level={4}>Business Justification</Title>
              <Form.Item
                name="reason"
                label="Why is this training needed?"
                rules={[
                  {
                    required: true,
                    message: "Please explain why this training is needed",
                  },
                  { min: 50, message: "Please provide at least 50 characters" },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Explain the specific need for this training, current challenges, and how it will benefit the team or organization..."
                />
              </Form.Item>
              <Form.Item
                name="businessImpact"
                label="Expected Business Impact"
                rules={[
                  {
                    required: true,
                    message: "Please describe the expected business impact",
                  },
                  { min: 30, message: "Please provide at least 30 characters" },
                ]}
              >
                <TextArea
                  rows={3}
                  placeholder="Describe how this training will improve performance, productivity, or business outcomes..."
                />
              </Form.Item>
              <Form.Item
                name="expectedOutcome"
                label="Expected Learning Outcomes"
                rules={[
                  {
                    required: true,
                    message: "Please describe expected learning outcomes",
                  },
                  { min: 30, message: "Please provide at least 30 characters" },
                ]}
              >
                <TextArea
                  rows={3}
                  placeholder="What specific skills, knowledge, or capabilities will participants gain?"
                />
              </Form.Item>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <Title level={4}>Review Your Request</Title>
              <Alert
                message="Please review your training request before submitting"
                type="info"
                showIcon
                style={{ marginBottom: "24px" }}
              />
              <Card size="small">
                <Row gutter={[16, 8]}>
                  <Col span={12}>
                    <Text strong>Training Type:</Text>
                    <br />
                    <Text>
                      {form.getFieldValue("trainingType") || "Not specified"}
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Target Audience:</Text>
                    <br />
                    <Text>
                      {form.getFieldValue("targetAudience") || "Not specified"}
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Participants:</Text>
                    <br />
                    <Text>
                      {form.getFieldValue("participants") || "Not specified"}{" "}
                      people
                    </Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>Priority:</Text>
                    <br />
                    <Tag
                      color={
                        priorityOptions.find(
                          (opt) => opt.value === form.getFieldValue("priority")
                        )?.color
                      }
                    >
                      {form.getFieldValue("priority") || "Not specified"}
                    </Tag>
                  </Col>
                  <Col span={24}>
                    <Text strong>Reason:</Text>
                    <Paragraph style={{ marginTop: "4px" }}>
                      {form.getFieldValue("reason") || "Not specified"}
                    </Paragraph>
                  </Col>
                  <Col span={24}>
                    <Text strong>Business Impact:</Text>
                    <Paragraph style={{ marginTop: "4px" }}>
                      {form.getFieldValue("businessImpact") || "Not specified"}
                    </Paragraph>
                  </Col>
                </Row>
              </Card>
            </div>
          )}

          <Divider />
          <div style={{ textAlign: "right" }}>
            <Space>
              {currentStep > 0 && (
                <Button onClick={() => setCurrentStep(currentStep - 1)}>
                  Previous
                </Button>
              )}
              {currentStep < steps.length - 1 ? (
                <Button
                  type="primary"
                  onClick={() => setCurrentStep(currentStep + 1)}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={<FormOutlined />}
                >
                  Submit Request
                </Button>
              )}
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

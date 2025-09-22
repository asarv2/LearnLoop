"use client";

import {
  CalendarOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  FilterOutlined,
  FormOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useState } from "react";

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

// Mock data for training requests
const requestsData = [
  {
    key: "1",
    id: "REQ001",
    employee: "John Smith",
    email: "john.smith@company.com",
    department: "Engineering",
    trainingType: "Technical Leadership",
    targetAudience: "Engineering Team",
    priority: "High",
    status: "Pending",
    reason:
      "Our team needs advanced technical leadership skills to better manage complex projects and mentor junior developers. This training would help us improve code quality and project delivery timelines.",
    businessImpact:
      "Improved project delivery, better team collaboration, reduced technical debt",
    expectedOutcome:
      "Enhanced technical leadership capabilities, improved team performance metrics",
    submittedDate: "2024-01-15",
    requestedDate: "2024-02-01",
    estimatedCost: "$2,500",
    participants: 8,
  },
];

const columns = [
  { title: "ID", dataIndex: "id", key: "id", width: 80 },
  {
    title: "Employee",
    dataIndex: "employee",
    key: "employee",
    render: (text: string, record: Record<string, unknown>) => (
      <Space>
        <UserOutlined />
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {String(record.department)}
          </Text>
        </div>
      </Space>
    ),
  },
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
    ),
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
  {
    title: "Actions",
    key: "actions",
    render: (record: Record<string, unknown>) => (
      <Space>
        <Button type="link" size="small" icon={<EyeOutlined />}>
          View
        </Button>
        {record.status === "Pending" && (
          <>
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => message.success("Approved")}
            >
              Approve
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => message.success("Rejected")}
            >
              Reject
            </Button>
          </>
        )}
      </Space>
    ),
  },
];

export default function AdminRequestsPage() {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedRequest] = useState<Record<string, unknown> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const filteredData = requestsData.filter((item) => {
    const matchesSearch =
      item.employee.toLowerCase().includes(searchText.toLowerCase()) ||
      item.trainingType.toLowerCase().includes(searchText.toLowerCase()) ||
      item.department.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || item.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

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
          Review and manage employee training requests
        </Text>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Search
              placeholder="Search requests..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: "100%" }}
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="Pending">Pending</Select.Option>
              <Select.Option value="In Review">In Review</Select.Option>
              <Select.Option value="Approved">Approved</Select.Option>
              <Select.Option value="Rejected">Rejected</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: "100%" }}
            >
              <Select.Option value="all">All Priorities</Select.Option>
              <Select.Option value="High">High</Select.Option>
              <Select.Option value="Medium">Medium</Select.Option>
              <Select.Option value="Low">Low</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} md={6}>
            <RangePicker style={{ width: "100%" }} />
          </Col>
          <Col xs={24} sm={24} md={4}>
            <Button icon={<FilterOutlined />} style={{ width: "100%" }}>
              Apply Filters
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Training Requests ({filteredData.length} items)
          </Title>
          <Space>
            <Button type="primary">Export</Button>
            <Button>Bulk Actions</Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Request Details Modal (simplified) */}
      <Modal
        title="Request Details"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedRequest && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong>Employee:</Text>
                <br />
                <Text>
                  {String(selectedRequest.employee)} (
                  {String(selectedRequest.email)})
                </Text>
              </Col>
              <Col span={12}>
                <Text strong>Department:</Text>
                <br />
                <Text>{String(selectedRequest.department)}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Training Type:</Text>
                <br />
                <Text>{String(selectedRequest.trainingType)}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Status:</Text>
                <br />
                <Tag
                  color={
                    selectedRequest.status === "Pending"
                      ? "blue"
                      : selectedRequest.status === "Approved"
                      ? "green"
                      : selectedRequest.status === "Rejected"
                      ? "red"
                      : "orange"
                  }
                >
                  {String(selectedRequest.status)}
                </Tag>
              </Col>
            </Row>
            <div style={{ marginTop: "16px" }}>
              <Text strong>Reason:</Text>
              <Paragraph style={{ marginTop: "8px" }}>
                {String(selectedRequest.reason)}
              </Paragraph>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

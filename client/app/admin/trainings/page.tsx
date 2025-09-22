"use client";

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";

const { Title } = Typography;

const trainingData = [
  {
    key: "1",
    title: "Critical Conversation",
    description: "Practice difficult workplace conversations",
    status: "active",
    participants: 45,
    completionRate: 78,
    lastUpdated: "2024-01-15",
  },
  {
    key: "2",
    title: "Leadership",
    description: "Develop leadership and management skills",
    status: "active",
    participants: 32,
    completionRate: 85,
    lastUpdated: "2024-01-14",
  },
  {
    key: "3",
    title: "Interview",
    description: "Interview preparation and practice",
    status: "active",
    participants: 28,
    completionRate: 92,
    lastUpdated: "2024-01-13",
  },
];

const columns = [
  {
    title: "Training",
    dataIndex: "title",
    key: "title",
    render: (text: string, record: Record<string, unknown>) => (
      <div>
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>{text}</div>
        <div style={{ color: "#666", fontSize: "12px" }}>
          {String(record.description)}
        </div>
      </div>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Tag color={status === "active" ? "green" : "red"}>
        {status.toUpperCase()}
      </Tag>
    ),
  },
  {
    title: "Participants",
    dataIndex: "participants",
    key: "participants",
    render: (count: number) => (
      <span style={{ fontWeight: "bold" }}>{count}</span>
    ),
  },
  {
    title: "Completion Rate",
    dataIndex: "completionRate",
    key: "completionRate",
    render: (rate: number) => (
      <span
        style={{
          color: rate >= 80 ? "#52c41a" : rate >= 60 ? "#fa8c16" : "#ff4d4f",
        }}
      >
        {rate}%
      </span>
    ),
  },
  {
    title: "Last Updated",
    dataIndex: "lastUpdated",
    key: "lastUpdated",
  },
  {
    title: "Actions",
    key: "actions",
    render: () => (
      <Space size="small">
        <Button type="text" icon={<EyeOutlined />} size="small">
          View
        </Button>
        <Button type="text" icon={<EditOutlined />} size="small">
          Edit
        </Button>
        <Button type="text" icon={<DeleteOutlined />} size="small" danger>
          Delete
        </Button>
      </Space>
    ),
  },
];

export default function AdminTrainingsPage() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Training Management
        </Title>
        <Button type="primary" icon={<PlayCircleOutlined />}>
          Create New Training
        </Button>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Trainings"
              value={3}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Trainings"
              value={3}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Participants"
              value={105}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={trainingData}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}

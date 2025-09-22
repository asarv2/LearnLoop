"use client";

import {
  CheckSquareOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

const { Title } = Typography;
const { Search } = Input;

const rubricData = [
  {
    key: "1",
    name: "Critical Conversation Rubric",
    description: "Evaluation criteria for critical conversation training",
    totalPoints: 100,
    standards: 5,
    lastUsed: "2024-01-15",
    status: "active",
  },
  {
    key: "2",
    name: "Leadership Assessment",
    description: "Comprehensive leadership skills evaluation",
    totalPoints: 150,
    standards: 7,
    lastUsed: "2024-01-14",
    status: "active",
  },
  {
    key: "3",
    name: "Interview Performance",
    description: "Interview skills and communication assessment",
    totalPoints: 80,
    standards: 4,
    lastUsed: "2024-01-13",
    status: "active",
  },
  {
    key: "4",
    name: "Old Communication Rubric",
    description: "Legacy communication assessment (deprecated)",
    totalPoints: 100,
    standards: 6,
    lastUsed: "2023-12-20",
    status: "archived",
  },
];

const columns = [
  {
    title: "Rubric Name",
    dataIndex: "name",
    key: "name",
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
    title: "Total Points",
    dataIndex: "totalPoints",
    key: "totalPoints",
    render: (points: number) => (
      <span style={{ fontWeight: "bold", color: "#1890ff" }}>{points}</span>
    ),
  },
  {
    title: "Standards",
    dataIndex: "standards",
    key: "standards",
    render: (count: number) => (
      <Tag icon={<CheckSquareOutlined />} color="blue">
        {count} standards
      </Tag>
    ),
  },
  {
    title: "Last Used",
    dataIndex: "lastUsed",
    key: "lastUsed",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Tag color={status === "active" ? "green" : "orange"}>
        {status.toUpperCase()}
      </Tag>
    ),
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

export default function AdminRubricsPage() {
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
          Rubric Management
        </Title>
        <Button type="primary" icon={<PlusOutlined />}>
          Create New Rubric
        </Button>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#1890ff",
                }}
              >
                4
              </div>
              <div style={{ color: "#666" }}>Total Rubrics</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#52c41a",
                }}
              >
                3
              </div>
              <div style={{ color: "#666" }}>Active</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#fa8c16",
                }}
              >
                1
              </div>
              <div style={{ color: "#666" }}>Archived</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#722ed1",
                }}
              >
                22
              </div>
              <div style={{ color: "#666" }}>Total Standards</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: "16px" }}>
          <Search
            placeholder="Search rubrics..."
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
          />
        </div>
        <Table
          columns={columns}
          dataSource={rubricData}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}

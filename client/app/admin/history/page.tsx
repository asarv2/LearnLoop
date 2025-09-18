"use client";

import {
  DownloadOutlined,
  EyeOutlined,
  FilterOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const historyData = [
  {
    key: "1",
    employee: "John Doe",
    training: "Critical Conversation",
    startedAt: "2024-01-15 10:30",
    completedAt: "2024-01-15 11:45",
    duration: "1h 15m",
    score: 85,
    status: "completed",
  },
  {
    key: "2",
    employee: "Jane Smith",
    training: "Leadership",
    startedAt: "2024-01-14 14:20",
    completedAt: "2024-01-14 15:30",
    duration: "1h 10m",
    score: 92,
    status: "completed",
  },
  {
    key: "3",
    employee: "Mike Johnson",
    training: "Interview",
    startedAt: "2024-01-13 09:15",
    completedAt: null,
    duration: "45m",
    score: null,
    status: "in_progress",
  },
  {
    key: "4",
    employee: "Sarah Wilson",
    training: "Critical Conversation",
    startedAt: "2024-01-12 16:00",
    completedAt: "2024-01-12 17:20",
    duration: "1h 20m",
    score: 78,
    status: "completed",
  },
];

const columns = [
  {
    title: "Employee",
    dataIndex: "employee",
    key: "employee",
    render: (text: string) => <div style={{ fontWeight: "bold" }}>{text}</div>,
  },
  {
    title: "Training",
    dataIndex: "training",
    key: "training",
    render: (text: string) => <Tag color="blue">{text}</Tag>,
  },
  {
    title: "Started",
    dataIndex: "startedAt",
    key: "startedAt",
    render: (text: string) => (
      <div>
        <div>{text.split(" ")[0]}</div>
        <div style={{ color: "#666", fontSize: "12px" }}>
          {text.split(" ")[1]}
        </div>
      </div>
    ),
  },
  {
    title: "Duration",
    dataIndex: "duration",
    key: "duration",
  },
  {
    title: "Score",
    dataIndex: "score",
    key: "score",
    render: (score: number | null) =>
      score ? (
        <div
          style={{
            color:
              score >= 80 ? "#52c41a" : score >= 60 ? "#fa8c16" : "#ff4d4f",
            fontWeight: "bold",
          }}
        >
          {score}%
        </div>
      ) : (
        <span style={{ color: "#666" }}>-</span>
      ),
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Tag
        color={
          status === "completed"
            ? "green"
            : status === "in_progress"
            ? "blue"
            : "red"
        }
      >
        {status.replace("_", " ").toUpperCase()}
      </Tag>
    ),
  },
  {
    title: "Actions",
    key: "actions",
    render: (_, record: any) => (
      <Space size="small">
        <Button type="text" icon={<EyeOutlined />} size="small">
          View
        </Button>
        <Button type="text" icon={<DownloadOutlined />} size="small">
          Report
        </Button>
      </Space>
    ),
  },
];

export default function AdminHistoryPage() {
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
          Training History
        </Title>
        <Button icon={<DownloadOutlined />}>Export Report</Button>
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
              <div style={{ color: "#666" }}>Total Sessions</div>
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
              <div style={{ color: "#666" }}>Completed</div>
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
              <div style={{ color: "#666" }}>In Progress</div>
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
                85%
              </div>
              <div style={{ color: "#666" }}>Avg. Score</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <Search
            placeholder="Search sessions..."
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
          />
          <Select placeholder="Filter by training" style={{ width: 200 }}>
            <Option value="all">All Trainings</Option>
            <Option value="Critical Conversation">Critical Conversation</Option>
            <Option value="Leadership">Leadership</Option>
            <Option value="Interview">Interview</Option>
          </Select>
          <Select placeholder="Filter by status" style={{ width: 150 }}>
            <Option value="all">All Status</Option>
            <Option value="completed">Completed</Option>
            <Option value="in_progress">In Progress</Option>
          </Select>
          <Button icon={<FilterOutlined />}>More Filters</Button>
        </div>
        <Table
          columns={columns}
          dataSource={historyData}
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}

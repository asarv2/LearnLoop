"use client";

import {
  CalendarOutlined,
  FilterOutlined,
  MessageOutlined,
  SearchOutlined,
  StarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";

const { Title, Text } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

// Mock data for training feedback
const feedbackData = [
  {
    key: "1",
    id: "FB001",
    user: "John Smith",
    email: "john.smith@company.com",
    training: "Critical Conversations",
    score: 85,
    strengths: [
      "Excellent active listening skills demonstrated throughout the session",
      "Showed great empathy when addressing difficult topics",
      "Maintained professional composure during challenging scenarios",
    ],
    improvements: [
      "Work on asking more open-ended questions to encourage dialogue",
      "Practice de-escalation techniques for high-tension situations",
      "Consider using more specific examples when providing feedback",
    ],
    date: "2024-01-15",
    duration: "45 min",
  },
  {
    key: "2",
    id: "FB002",
    user: "Sarah Johnson",
    email: "sarah.j@company.com",
    training: "Leadership Development",
    score: 92,
    strengths: [
      "Natural leadership presence and confidence",
      "Excellent delegation skills and team management",
      "Clear communication and vision setting",
    ],
    improvements: [
      "Focus on providing more constructive feedback to team members",
      "Practice conflict resolution strategies",
      "Develop stronger emotional intelligence in team dynamics",
    ],
    date: "2024-01-14",
    duration: "60 min",
  },
  {
    key: "3",
    id: "FB003",
    user: "Mike Wilson",
    email: "mike.w@company.com",
    training: "Interview Skills",
    score: 78,
    strengths: [
      "Good technical knowledge and expertise",
      "Clear articulation of past experiences",
      "Professional demeanor and appearance",
    ],
    improvements: [
      "Practice the STAR method for answering behavioral questions",
      "Work on reducing nervous habits during interviews",
      "Prepare more specific examples of leadership and teamwork",
    ],
    date: "2024-01-13",
    duration: "30 min",
  },
  {
    key: "4",
    id: "FB004",
    user: "Emily Davis",
    email: "emily.d@company.com",
    training: "Critical Conversations",
    score: 88,
    strengths: [
      "Outstanding preparation and research on topics",
      "Excellent follow-up and action planning",
      "Strong emotional regulation during difficult discussions",
    ],
    improvements: [
      "Work on being more direct in addressing sensitive issues",
      "Practice active listening without interrupting",
      "Develop strategies for handling defensive responses",
    ],
    date: "2024-01-12",
    duration: "50 min",
  },
  {
    key: "5",
    id: "FB005",
    user: "David Brown",
    email: "david.b@company.com",
    training: "Leadership Development",
    score: 72,
    strengths: [
      "Good understanding of leadership principles",
      "Willingness to learn and adapt",
      "Strong work ethic and commitment",
    ],
    improvements: [
      "Focus on developing stronger communication skills",
      "Practice giving and receiving feedback more effectively",
      "Work on building trust and rapport with team members",
      "Develop better time management and prioritization skills",
    ],
    date: "2024-01-11",
    duration: "55 min",
  },
];

const columns = [
  {
    title: "ID",
    dataIndex: "id",
    key: "id",
    width: 80,
  },
  {
    title: "Employee",
    dataIndex: "user",
    key: "user",
    render: (text: string, record: any) => (
      <Space>
        <UserOutlined />
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.email}
          </Text>
        </div>
      </Space>
    ),
  },
  {
    title: "Training",
    dataIndex: "training",
    key: "training",
    render: (training: string) => {
      const colors: { [key: string]: string } = {
        "Critical Conversations": "blue",
        "Leadership Development": "green",
        "Interview Skills": "purple",
      };
      return <Tag color={colors[training]}>{training}</Tag>;
    },
  },
  {
    title: "Score",
    dataIndex: "score",
    key: "score",
    render: (score: number) => {
      const getColor = (score: number) => {
        if (score >= 90) return "#52c41a";
        if (score >= 80) return "#1890ff";
        if (score >= 70) return "#faad14";
        return "#ff4d4f";
      };
      return (
        <Text strong style={{ color: getColor(score), fontSize: "16px" }}>
          {score}%
        </Text>
      );
    },
  },
  {
    title: "Strengths",
    dataIndex: "strengths",
    key: "strengths",
    render: (strengths: string[]) => (
      <div>
        {strengths.slice(0, 2).map((strength, index) => (
          <div key={index} style={{ marginBottom: "4px" }}>
            <Text style={{ fontSize: "12px" }}>• {strength}</Text>
          </div>
        ))}
        {strengths.length > 2 && (
          <Text type="secondary" style={{ fontSize: "11px" }}>
            +{strengths.length - 2} more
          </Text>
        )}
      </div>
    ),
    ellipsis: true,
    width: 250,
  },
  {
    title: "Improvements",
    dataIndex: "improvements",
    key: "improvements",
    render: (improvements: string[]) => (
      <div>
        {improvements.slice(0, 2).map((improvement, index) => (
          <div key={index} style={{ marginBottom: "4px" }}>
            <Text style={{ fontSize: "12px" }}>• {improvement}</Text>
          </div>
        ))}
        {improvements.length > 2 && (
          <Text type="secondary" style={{ fontSize: "11px" }}>
            +{improvements.length - 2} more
          </Text>
        )}
      </div>
    ),
    ellipsis: true,
    width: 250,
  },
  {
    title: "Duration",
    dataIndex: "duration",
    key: "duration",
    width: 100,
  },
  {
    title: "Date",
    dataIndex: "date",
    key: "date",
    render: (date: string) => (
      <Space>
        <CalendarOutlined />
        {date}
      </Space>
    ),
    width: 120,
  },
  {
    title: "Actions",
    key: "actions",
    render: (record: any) => (
      <Space>
        <Button type="link" size="small">
          View Details
        </Button>
        <Button type="link" size="small">
          Export
        </Button>
      </Space>
    ),
    width: 120,
  },
];

export default function AdminFeedbackPage() {
  const [searchText, setSearchText] = useState("");
  const [trainingFilter, setTrainingFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");

  const filteredData = feedbackData.filter((item) => {
    const matchesSearch =
      item.user.toLowerCase().includes(searchText.toLowerCase()) ||
      item.training.toLowerCase().includes(searchText.toLowerCase());
    const matchesTraining =
      trainingFilter === "all" || item.training === trainingFilter;
    const matchesScore = (() => {
      if (scoreFilter === "all") return true;
      if (scoreFilter === "excellent") return item.score >= 90;
      if (scoreFilter === "good") return item.score >= 80 && item.score < 90;
      if (scoreFilter === "fair") return item.score >= 70 && item.score < 80;
      if (scoreFilter === "needs-improvement") return item.score < 70;
      return true;
    })();

    return matchesSearch && matchesTraining && matchesScore;
  });

  const totalFeedback = feedbackData.length;
  const excellentScores = feedbackData.filter(
    (item) => item.score >= 90
  ).length;
  const avgScore =
    feedbackData.reduce((sum, item) => sum + item.score, 0) / totalFeedback;
  const needsImprovement = feedbackData.filter(
    (item) => item.score < 70
  ).length;

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title
          level={2}
          style={{ margin: 0, display: "flex", alignItems: "center" }}
        >
          <MessageOutlined style={{ marginRight: "12px", color: "#1890ff" }} />
          Training Feedback
        </Title>
        <Text type="secondary">
          Review employee performance feedback from training sessions
        </Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Sessions"
              value={totalFeedback}
              prefix={<MessageOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Excellent Scores"
              value={excellentScores}
              prefix={<StarOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Average Score"
              value={avgScore.toFixed(1)}
              suffix="%"
              prefix={<StarOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Needs Improvement"
              value={needsImprovement}
              suffix={`/ ${totalFeedback}`}
              valueStyle={{ color: "#ff4d4f" }}
            />
            <Progress
              percent={Math.round((needsImprovement / totalFeedback) * 100)}
              size="small"
              style={{ marginTop: "8px" }}
              strokeColor="#ff4d4f"
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Search
              placeholder="Search by employee or training..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Training Type"
              value={trainingFilter}
              onChange={setTrainingFilter}
              style={{ width: "100%" }}
            >
              <Select.Option value="all">All Trainings</Select.Option>
              <Select.Option value="Critical Conversations">
                Critical Conversations
              </Select.Option>
              <Select.Option value="Leadership Development">
                Leadership Development
              </Select.Option>
              <Select.Option value="Interview Skills">
                Interview Skills
              </Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Score Range"
              value={scoreFilter}
              onChange={setScoreFilter}
              style={{ width: "100%" }}
            >
              <Select.Option value="all">All Scores</Select.Option>
              <Select.Option value="excellent">Excellent (90%+)</Select.Option>
              <Select.Option value="good">Good (80-89%)</Select.Option>
              <Select.Option value="fair">Fair (70-79%)</Select.Option>
              <Select.Option value="needs-improvement">
                Needs Improvement (&lt;70%)
              </Select.Option>
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

      {/* Feedback Table */}
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
            Feedback List ({filteredData.length} items)
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
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}

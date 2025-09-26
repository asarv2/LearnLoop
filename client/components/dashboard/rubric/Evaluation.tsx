/**
 * Evaluation.tsx
 * Used to show the evaluation of the training.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useRubrics } from "@/lib/api/hooks/useRubrics";
import { useScenarios } from "@/lib/api/hooks/useScenarios";
import { useStandards } from "@/lib/api/hooks/useStandards";
import { useTrainings } from "@/lib/api/hooks/useTrainings";
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SafetyOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Row,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

const { Title, Text, Paragraph } = Typography;

// Array of colors and icons for training modules (similar to Trainings.tsx)
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

interface RubricCriteria {
  category: string;
  description: string;
  score1: string;
  score2: string;
  score3: string;
  score4: string;
  score5: string;
}

export default function Evaluation() {
  const [selectedRubric, setSelectedRubric] = useState<string | null>(null);

  const { data: trainings } = useTrainings();
  const { data: scenarios } = useScenarios();
  const { data: rubrics } = useRubrics(null);
  const { data: standards } = useStandards();

  // Filter trainings that are practice mode and sort active ones first
  const filteredTrainings =
    trainings?.filter((training) => training.practice) || [];

  const sortedTrainings = filteredTrainings.sort((a, b) => {
    // Sort active trainings first, then inactive ones
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return 0;
  });

  // Create dynamic rubric modules based on actual data
  const dynamicRubricModules = sortedTrainings.map((training, index) => {
    const scenario = scenarios?.find((s) => s.training_id === training.id);
    const rubric = rubrics?.find((r) => r.id === scenario?.rubric_id);
    const trainingStandards =
      standards?.filter((s) => s.rubric_id === rubric?.id) || [];

    // Use predefined colors and icons from the array
    const color = trainingColors[index % trainingColors.length];
    const icon = trainingIcons[index % trainingIcons.length];

    return {
      id: training.id,
      title: `${training.title} Rubric`,
      description:
        training.description ||
        `Evaluation framework for ${training.title.toLowerCase()} scenarios.`,
      icon,
      status: training.active ? "available" : "coming-soon",
      color,
      training,
      rubric,
      standards: trainingStandards,
    };
  });

  // Convert standards to rubric criteria format
  const convertStandardsToRubricCriteria = (
    standards: Array<{
      name: string;
      description?: string | null;
      items?: string[] | null;
    }>
  ): RubricCriteria[] => {
    return standards
      .filter((standard) => standard && standard.name)
      .map((standard) => ({
        category: standard.name,
        description: standard.description || "",
        score1: standard.items?.[0] || "Poor performance",
        score2: standard.items?.[1] || "Needs improvement",
        score3: standard.items?.[2] || "Satisfactory",
        score4: standard.items?.[3] || "Good",
        score5: standard.items?.[4] || "Excellent",
      }));
  };

  // Get rubric data for selected rubric
  const getSelectedRubricData = () => {
    if (!selectedRubric) return null;

    const selectedModule = dynamicRubricModules.find(
      (m) => m.id === selectedRubric
    );
    if (!selectedModule || !selectedModule.standards) return null;

    return convertStandardsToRubricCriteria(selectedModule.standards);
  };

  const selectedRubricData = getSelectedRubricData();
  const selectedModule = dynamicRubricModules.find(
    (m) => m.id === selectedRubric
  );

  const rubricColumns: ColumnsType<RubricCriteria> = [
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 200,
      fixed: "left",
      render: (text: string, record: RubricCriteria) => (
        <Space direction="vertical" size={4}>
          <Text strong style={{ color: "#1890ff" }}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: "1 - Poor",
      dataIndex: "score1",
      key: "score1",
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: "13px", lineHeight: "1.4" }}>{text}</Text>
      ),
    },
    {
      title: "2 - Needs Improvement",
      dataIndex: "score2",
      key: "score2",
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: "13px", lineHeight: "1.4" }}>{text}</Text>
      ),
    },
    {
      title: "3 - Satisfactory",
      dataIndex: "score3",
      key: "score3",
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: "13px", lineHeight: "1.4" }}>{text}</Text>
      ),
    },
    {
      title: "4 - Good",
      dataIndex: "score4",
      key: "score4",
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: "13px", lineHeight: "1.4" }}>{text}</Text>
      ),
    },
    {
      title: "5 - Excellent",
      dataIndex: "score5",
      key: "score5",
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: "13px", lineHeight: "1.4" }}>{text}</Text>
      ),
    },
  ];

  // Show selected rubric details
  if (selectedRubric && selectedModule && selectedRubricData) {
    return (
      <div>
        <Space align="center" style={{ marginBottom: "24px" }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedRubric(null)}
          >
            Back to Rubrics
          </Button>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "12px",
              background: `linear-gradient(135deg, ${selectedModule.color} 0%, ${selectedModule.color}99 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: "24px", color: "white" }}>
              {selectedModule.icon}
            </div>
          </div>
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              {selectedModule.title}
            </Title>
            <Text type="secondary">{selectedModule.description}</Text>
          </Space>
        </Space>

        <Alert
          message="Scoring Formula"
          description="Overall Score = (Sum of all category scores ÷ Number of categories) × 20 = Score out of 100"
          type="info"
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: "24px" }}
        />

        <Card>
          <Table
            columns={rubricColumns}
            dataSource={selectedRubricData}
            rowKey="category"
            pagination={false}
            scroll={{ x: 1200 }}
            size="middle"
          />
        </Card>

        <Card style={{ marginTop: "24px" }} type="inner">
          <Title level={4}>How to Use This Rubric</Title>
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Paragraph>
                <Text strong>During the {selectedModule.training.title}:</Text>
                <br />• Take notes on each category as you observe the
                performance
                <br />
                • Focus on specific examples and behaviors
                <br />• Consider the context and complexity of the scenario
              </Paragraph>
            </Col>
            <Col xs={24} md={12}>
              <Paragraph>
                <Text strong>After the {selectedModule.training.title}:</Text>
                <br />
                • Score each category on the 1-5 scale
                <br />
                • Calculate the overall score using the formula above
                <br />• Provide specific feedback with examples from each
                category
              </Paragraph>
            </Col>
          </Row>
        </Card>
      </div>
    );
  }

  // Show coming soon for unavailable rubrics
  if (selectedRubric && selectedModule && !selectedRubricData) {
    return (
      <div>
        <Space align="center" style={{ marginBottom: "24px" }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedRubric(null)}
          >
            Back to Rubrics
          </Button>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "12px",
              background: `linear-gradient(135deg, ${selectedModule.color} 0%, ${selectedModule.color}99 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: "24px", color: "white" }}>
              {selectedModule.icon}
            </div>
          </div>
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              {selectedModule.title}
            </Title>
            <Badge count="Coming Soon" style={{ backgroundColor: "#fa8c16" }} />
          </Space>
        </Space>

        <Card style={{ textAlign: "center", padding: "80px 40px" }}>
          <Space direction="vertical" size="large">
            <Text style={{ fontSize: "48px" }}>🚧</Text>
            <Title level={4}>Work in Progress</Title>
            <Paragraph
              type="secondary"
              style={{ maxWidth: "500px", margin: "0 auto" }}
            >
              This rubric is currently being developed and will be available
              soon with comprehensive evaluation criteria tailored for{" "}
              {selectedModule.title.toLowerCase().replace(" rubric", "")}{" "}
              scenarios.
            </Paragraph>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <Title level={2}>Evaluation Frameworks</Title>
        <Paragraph type="secondary" style={{ fontSize: "16px" }}>
          Comprehensive evaluation criteria for assessing performance across all
          simulation types and training modules.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {dynamicRubricModules.map((module) => (
          <Col xs={24} sm={12} lg={8} key={module.id}>
            <Card
              hoverable={module.status === "available"}
              onClick={() => module.id && setSelectedRubric(module.id)}
              style={{
                height: "100%",
                cursor: "pointer",
                transition: "all 0.3s ease",
                opacity: module.status === "coming-soon" ? 0.8 : 1,
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "48px",
                    color: module.color,
                    marginBottom: "12px",
                  }}
                >
                  {module.icon}
                </div>
                <Title level={4} style={{ margin: 0 }}>
                  {module.title}
                  {module.status === "coming-soon" && (
                    <div style={{ marginTop: "8px" }}>
                      <Badge
                        count="Soon"
                        style={{ backgroundColor: "#fa8c16" }}
                      />
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
                    minHeight: "60px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {module.description}
                </Paragraph>
              </div>

              <div style={{ textAlign: "center" }}>
                <Button
                  type={module.status === "available" ? "primary" : "default"}
                  disabled={module.status === "coming-soon"}
                  style={{
                    backgroundColor:
                      module.status === "available" ? module.color : undefined,
                    borderColor:
                      module.status === "available" ? module.color : undefined,
                  }}
                >
                  {module.status === "available"
                    ? "View Rubric Details"
                    : "Coming Soon"}
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="Rubric Information"
        style={{ marginTop: "32px" }}
        type="inner"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Title level={5}>Purpose</Title>
            <Paragraph type="secondary">
              These rubrics provide standardized evaluation criteria to ensure
              consistent and fair assessment of performance across different
              training scenarios. Each rubric is designed to measure specific
              competencies relevant to the training module.
            </Paragraph>
          </Col>
          <Col xs={24} md={12}>
            <Title level={5}>Usage Guidelines</Title>
            <Paragraph type="secondary">
              Use these rubrics during or immediately after training sessions to
              evaluate performance objectively. The scoring system helps
              identify strengths and areas for improvement, providing targeted
              feedback for skill development.
            </Paragraph>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

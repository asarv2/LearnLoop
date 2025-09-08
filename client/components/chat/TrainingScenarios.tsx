/**
 * TrainingScenarios.tsx
 * Used to show all of the scenarios for a training.
 * @AshokSaravanan222 & @siladie
 * 08-09-2025
 */

"use client";

import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import {
  BulbOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  HeartOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SafetyOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Spin, Typography } from "antd";
import Link from "next/link";

const { Title, Paragraph } = Typography;

interface TrainingScenariosProps {
  trainingId: string;
}

// Array of colors and icons for scenario cards
const scenarioColors = [
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

const scenarioIcons = [
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

// Helper component to handle scenario card
function ScenarioCard({
  scenario,
  index,
}: {
  scenario: {
    id?: string;
    title: string;
    description?: string | null;
    problem_statement?: string | null;
  };
  index: number;
}) {
  const color = scenarioColors[index % scenarioColors.length];
  const icon = scenarioIcons[index % scenarioIcons.length];

  const href = scenario.id ? `/dashboard/trainings/s/${scenario.id}` : "#";

  return (
    <Col xs={24} sm={12} lg={8} key={scenario.id}>
      <Card
        hoverable={true}
        style={{
          height: "100%",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div
            style={{
              fontSize: "48px",
              color: color,
              marginBottom: "12px",
            }}
          >
            {icon}
          </div>
          <Title level={4} style={{ margin: 0 }}>
            {scenario.title}
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
            {scenario.description ||
              scenario.problem_statement ||
              "No description available"}
          </Paragraph>
        </div>

        <div style={{ textAlign: "center" }}>
          <Link href={href}>
            <Button
              type="primary"
              style={{
                backgroundColor: color,
                borderColor: color,
              }}
            >
              Start Scenario
            </Button>
          </Link>
        </div>
      </Card>
    </Col>
  );
}

export default function TrainingScenarios({
  trainingId,
}: TrainingScenariosProps) {
  const {
    data: scenarios,
    isLoading,
    error,
  } = useScenariosByTrainingId(trainingId);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "16px" }}>Loading scenarios...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Title level={3} type="danger">
          Error loading scenarios
        </Title>
        <Paragraph type="secondary">Please try again later.</Paragraph>
      </div>
    );
  }

  // Filter scenarios to only show those with parent_id not equal to null
  const filteredScenarios =
    scenarios?.filter((scenario) => scenario.parent_id !== null) || [];

  if (filteredScenarios.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Title level={3}>No scenarios available</Title>
        <Paragraph type="secondary">
          There are no scenarios available for this training yet.
        </Paragraph>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <Title level={2}>Training Scenarios</Title>
        <Paragraph type="secondary" style={{ fontSize: "16px" }}>
          Choose a scenario to begin your training session. Each scenario
          provides a unique learning experience with focused objectives and
          realistic challenges.
        </Paragraph>
      </div>

      {/* Scenario Cards Grid */}
      <Row gutter={[24, 24]}>
        {filteredScenarios.map((scenario, index) => (
          <ScenarioCard key={scenario.id} scenario={scenario} index={index} />
        ))}
      </Row>
    </div>
  );
}

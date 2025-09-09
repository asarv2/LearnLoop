/**
 * TrainingScenarios.tsx
 * Used to show all of the scenarios for a training.
 * @AshokSaravanan222 & @siladie
 * 08-09-2025
 */

"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import { useTraining } from "@/lib/api/hooks/useTrainings";
import {
  ArrowLeftOutlined,
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
import { useRouter } from "next/navigation";
import { useState } from "react";

const { Title, Paragraph } = Typography;

interface TrainingScenariosProps {
  trainingId: string;
}

// Simple color and icon sets for scenarios
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
  onStart,
  loading,
}: {
  scenario: {
    id?: string;
    title: string;
    description?: string | null;
    problem_statement?: string | null;
    objectives?: string[] | null;
  };
  index: number;
  onStart: () => void;
  loading: boolean;
}) {
  const problemText =
    scenario.problem_statement ||
    scenario.description ||
    "No problem statement provided";
  const color = scenarioColors[index % scenarioColors.length];
  const icon = scenarioIcons[index % scenarioIcons.length];

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
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "40px", color, marginBottom: "8px" }}>
            {icon}
          </div>
          <Title level={4} style={{ margin: 0 }}>
            {scenario.title}
          </Title>
        </div>

        <div
          style={{
            textAlign: "center",
            minHeight: "120px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
          }}
        >
          <Paragraph
            type="secondary"
            style={{ margin: 0, textAlign: "center" }}
          >
            {problemText}
          </Paragraph>
        </div>

        <div style={{ textAlign: "center" }}>
          <Button
            type="primary"
            onClick={onStart}
            loading={loading}
            style={{ backgroundColor: color, borderColor: color }}
          >
            Start Scenario
          </Button>
        </div>
      </Card>
    </Col>
  );
}

export default function TrainingScenarios({
  trainingId,
}: TrainingScenariosProps) {
  const { user } = useAuth();
  const { emitStartTraining } = useWebSocket();
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const { data: training } = useTraining(trainingId, Boolean(trainingId));
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
        <div style={{ marginBottom: "16px" }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
            style={{ marginBottom: "16px" }}
          >
            Back to Trainings
          </Button>
        </div>
        <Title level={2}>
          {training?.title ? `${training.title} Scenarios` : "Scenarios"}
        </Title>
        <Paragraph type="secondary" style={{ fontSize: "16px" }}>
          Choose a scenario to begin your training session. Each scenario
          provides a unique learning experience with focused objectives and
          realistic challenges.
        </Paragraph>
      </div>

      {/* Scenario Cards Grid */}
      <Row gutter={[24, 24]}>
        {filteredScenarios.map((scenario, index) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            index={index}
            loading={startingId === scenario.id}
            onStart={() => {
              if (!scenario.id) return;
              setStartingId(scenario.id);
              emitStartTraining({
                scenario_id: scenario.id,
                profile_id: user?.id || undefined,
              });
            }}
          />
        ))}
      </Row>
    </div>
  );
}

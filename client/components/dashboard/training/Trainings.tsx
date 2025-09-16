/**
 * Trainings.tsx
 * Used to show all of the trainings that are practice.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import { useTrainingsPractice } from "@/lib/api/hooks/useTrainings";
import {
  BulbOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  HeartOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SafetyOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import { Badge, Button, Card, Col, Row, Spin, Typography } from "antd";
import Link from "next/link";

const { Title, Paragraph } = Typography;

// Array of colors and icons for training modules
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

// Helper component to handle training card with scenario routing
function TrainingCard({
  training,
  index,
}: {
  training: {
    id?: string;
    title: string;
    description?: string | null;
    active?: boolean | null;
  };
  index: number;
}) {
  const { data: scenarios } = useScenariosByTrainingId(
    training.id || "",
    training.active || false
  );

  const color = trainingColors[index % trainingColors.length];
  const icon = trainingIcons[index % trainingIcons.length];

  // Get the root scenario (parent_id = null) if available, otherwise fallback to first scenario
  const rootScenario = scenarios?.find(
    (scenario) => scenario.parent_id === null
  );
  const fallbackScenario = scenarios?.[0];
  const targetScenario = rootScenario || fallbackScenario;
  const href =
    targetScenario && targetScenario.id
      ? `/dashboard/trainings/s/${targetScenario.id}`
      : "#";

  return (
    <Col xs={24} sm={12} lg={8} key={training.id}>
      <Card
        hoverable={training.active || false}
        style={{
          height: "100%",
          cursor: training.active ? "pointer" : "default",
          transition: "all 0.3s ease",
          opacity: training.active ? 1 : 0.8,
          position: "relative",
        }}
      >
        {/* Scenarios Icon with Tooltip */}
        {/* {training.active && training.id && (
          <Link href={`/dashboard/trainings/t/${training.id}/scenarios`}>
            <Tooltip
              title="View all scenarios"
              placement="top"
              overlayStyle={{ zIndex: 1000 }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  zIndex: 10,
                  cursor: "pointer",
                  padding: "4px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255, 255, 255, 1)";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255, 255, 255, 0.9)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <UnorderedListOutlined
                  style={{
                    fontSize: "16px",
                    color: color,
                  }}
                />
              </div>
            </Tooltip>
          </Link>
        )} */}
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
            {training.title}
            {!training.active && (
              <div style={{ marginTop: "8px" }}>
                <Badge count="Soon" style={{ backgroundColor: "#fa8c16" }} />
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
            {training.description || "No description available"}
          </Paragraph>
        </div>

        <div style={{ textAlign: "center" }}>
          {training.active ? (
            <Link href={href}>
              <Button
                type="primary"
                style={{
                  backgroundColor: color,
                  borderColor: color,
                }}
              >
                Start Training
              </Button>
            </Link>
          ) : (
            <Button
              disabled
              style={{
                backgroundColor: color,
                borderColor: color,
              }}
            >
              Coming Soon
            </Button>
          )}
        </div>
      </Card>
    </Col>
  );
}

export default function Trainings() {
  const { data: trainings, isLoading, error } = useTrainingsPractice();

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "16px" }}>Loading training modules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Title level={3} type="danger">
          Error loading training modules
        </Title>
        <Paragraph type="secondary">Please try again later.</Paragraph>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div style={{ marginBottom: "32px" }}>
        <Title level={2}>Professional Training Modules</Title>
        <Paragraph type="secondary" style={{ fontSize: "16px" }}>
          Enhance your leadership and management capabilities through immersive,
          AI-powered training experiences designed for today&apos;s corporate
          environment. Each scenario features focused AI personas for realistic
          practice.
        </Paragraph>
      </div>

      {/* Training Cards Grid */}
      <Row gutter={[24, 24]}>
        {trainings
          ?.filter((training) => {
            // Hide Interview Training module
            return !training.title.toLowerCase().includes("interview");
          })
          .sort((a, b) => {
            // Sort "Offboarding Practice" first, then other trainings
            if (a.title.toLowerCase().includes("difficult conversations"))
              return -1;
            if (b.title.toLowerCase().includes("difficult conversations"))
              return 1;
            return 0;
          })
          .map(
            (training, index) =>
              training.active !== null && (
                <TrainingCard
                  key={training.id}
                  training={training}
                  index={index}
                />
              )
          )}
        {/* Static card: Create your own trainings */}
        <Col xs={24} sm={12} lg={8}>
          <Badge.Ribbon text="Coming Soon" color="orange">
            <Card
              hoverable={false}
              style={{
                height: "100%",
                cursor: "default",
                transition: "all 0.3s ease",
                opacity: 1,
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "48px",
                    color: trainingColors[0],
                    marginBottom: "12px",
                  }}
                >
                  <PlusOutlined />
                </div>
                <Title level={4} style={{ margin: 0 }}>
                  Create your own trainings
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
                  Build custom scenarios tailored to your team&apos;s workflows
                  and standards.
                </Paragraph>
              </div>

              {/* Invisible spacer to match button height on other cards */}
              <div style={{ textAlign: "center" }}>
                <Button style={{ visibility: "hidden" }}>Start Training</Button>
              </div>
            </Card>
          </Badge.Ribbon>
        </Col>
      </Row>

      {/* Footer Information */}
      {/* <Card
        title="Advanced AI-Powered Learning"
        style={{ marginTop: "32px" }}
        type="inner"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Title level={5}>Corporate-Ready Solutions</Title>
            <Paragraph type="secondary">
              Our training platform leverages cutting-edge artificial
              intelligence to create realistic workplace scenarios. Each module
              provides personalized feedback and comprehensive analytics to
              accelerate your professional development.
            </Paragraph>
          </Col>
          <Col xs={24} md={12}>
            <Title level={5}>Real-World Application</Title>
            <Paragraph type="secondary">
              Designed specifically for corporate environments, our modules
              focus on real-world challenges that managers and leaders face
              daily. Each scenario features focused AI personas for realistic
              practice in a risk-free environment.
            </Paragraph>
          </Col>
        </Row>
      </Card> */}
    </div>
  );
}

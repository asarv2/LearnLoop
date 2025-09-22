/**
 * TrainingEditor.tsx
 * Used to edit the training with enhanced descriptions and multiple persona indicators.
 * @AshokSaravanan222 & @siladie
 * 08-03-2025
 */

"use client";

import { useScenariosByTrainingId } from "@/lib/api/hooks/useScenarios";
import { useTraining } from "@/lib/api/hooks/useTrainings";
import { TeamOutlined } from "@ant-design/icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Card, Col, Row, Spin, Typography } from "antd";
import { useMemo } from "react";

const { Title, Paragraph } = Typography;

export interface TrainingEditorProps {
  trainingId: string;
}

export default function TrainingEditor({ trainingId }: TrainingEditorProps) {
  const { data: training, isLoading: trainingLoading } =
    useTraining(trainingId);
  const { data: scenarios } = useScenariosByTrainingId(trainingId, true);

  // Calculate if training has multiple AI personas
  const hasMultiplePersonas = useMemo(() => {
    if (!scenarios) return false;

    const rootScenarios = scenarios.filter(
      (scenario) => scenario.parent_id === null
    );
    return rootScenarios.some(
      (scenario) => scenario.group_ids && scenario.group_ids.length > 1
    );
  }, [scenarios]);

  // Get training description from Supabase data
  const trainingDescription = useMemo(() => {
    if (!training) return null;

    // Use database description if available
    if (training.description) {
      return training.description;
    }

    // Fallback based on title if no database description
    const title = training.title.toLowerCase();
    if (
      title.includes("difficult conversations") ||
      title.includes("critical conversations")
    ) {
      return "Master the art of navigating challenging workplace discussions with confidence. Practice delivering difficult feedback, addressing performance issues, and managing conflict resolution through realistic AI-powered scenarios that mirror real corporate situations.";
    }
    if (title.includes("interview")) {
      return "Develop advanced interviewing skills through comprehensive practice sessions. Learn to ask probing questions, assess candidates effectively, and conduct professional interviews that identify top talent while maintaining a positive candidate experience.";
    }
    if (title.includes("leadership")) {
      return "Build essential leadership capabilities through immersive training experiences. Practice decision-making, team management, strategic thinking, and employee development in scenarios designed to prepare you for senior management roles.";
    }
    return "Comprehensive professional development training designed to enhance your workplace skills and career advancement potential.";
  }, [training]);

  if (trainingLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
        <div style={{ marginTop: "16px" }}>Loading training details...</div>
      </div>
    );
  }

  if (!training) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Title level={4} type="danger">
          Training not found
        </Title>
        <Paragraph type="secondary">
          The requested training could not be found.
        </Paragraph>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px" }}>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card
            style={{
              position: "relative",
            }}
          >
            {/* Multiple Persona Icon */}
            {hasMultiplePersonas && (
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  zIndex: 10,
                }}
              >
                <Tooltip.Provider>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: "#1890ff",
                          color: "white",
                          cursor: "pointer",
                          fontSize: "16px",
                        }}
                      >
                        <TeamOutlined />
                      </div>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className="TooltipContent"
                        sideOffset={5}
                        style={{
                          backgroundColor: "var(--gray-12)",
                          color: "white",
                          borderRadius: "6px",
                          padding: "8px 12px",
                          fontSize: "14px",
                          lineHeight: "1.4",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                          zIndex: 1000,
                        }}
                      >
                        Multiple AI personas
                        <Tooltip.Arrow style={{ fill: "var(--gray-12)" }} />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </div>
            )}

            <div style={{ marginBottom: "24px" }}>
              <Title level={2} style={{ marginBottom: "16px" }}>
                {training.title}
              </Title>

              {trainingDescription && (
                <Paragraph style={{ fontSize: "16px", lineHeight: "1.6" }}>
                  {trainingDescription}
                </Paragraph>
              )}
            </div>

            <div style={{ marginTop: "24px" }}>
              <Title level={4}>Training Details</Title>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div>
                    <strong>Training Type:</strong>{" "}
                    {training.training_type || "Standard"}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div>
                    <strong>Status:</strong>{" "}
                    {training.active ? "Active" : "Inactive"}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div>
                    <strong>Practice Mode:</strong>{" "}
                    {training.practice ? "Enabled" : "Disabled"}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div>
                    <strong>Show Documents:</strong>{" "}
                    {training.show_documents ? "Yes" : "No"}
                  </div>
                </Col>
                {scenarios && (
                  <Col xs={24}>
                    <div>
                      <strong>Scenarios:</strong> {scenarios.length} scenario
                      {scenarios.length !== 1 ? "s" : ""}
                      {hasMultiplePersonas && (
                        <span style={{ marginLeft: "8px", color: "#1890ff" }}>
                          (Multiple AI personas available)
                        </span>
                      )}
                    </div>
                  </Col>
                )}
              </Row>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

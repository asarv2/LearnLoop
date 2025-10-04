"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useWebSocket } from "@/contexts/websocket-context";
import { SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  message,
  Row,
  Space,
  Table,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Standard {
  id: string;
  name: string;
  description: string;
  items: string[];
}

export default function CreateRubricPage() {
  const { effectiveProfile, isProfileLoading } = useAuth();
  const { emitGenerateRubric } = useWebSocket();
  const router = useRouter();

  const [rubricName, setRubricName] = useState("");
  const [rubricDescription, setRubricDescription] = useState("");
  const [standards, setStandards] = useState<Standard[]>([
    {
      id: "1",
      name: "",
      description: "",
      items: ["", "", "", "", ""],
    },
    {
      id: "2",
      name: "",
      description: "",
      items: ["", "", "", "", ""],
    },
    {
      id: "3",
      name: "",
      description: "",
      items: ["", "", "", "", ""],
    },
    {
      id: "4",
      name: "",
      description: "",
      items: ["", "", "", "", ""],
    },
    {
      id: "5",
      name: "",
      description: "",
      items: ["", "", "", "", ""],
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Listen for rubric generation response
  useEffect(() => {
    const handleRubricGenerated = (event: CustomEvent) => {
      const { success, standards: generatedStandards, message } = event.detail;

      if (success && generatedStandards) {
        // Update the standards with the generated items
        const updatedStandards = standards.map((s) => {
          const generatedStandard = generatedStandards.find(
            (gs: { name: string; items: string[] }) => gs.name === s.name
          );
          if (generatedStandard && generatedStandard.items) {
            return {
              ...s,
              items: generatedStandard.items,
            };
          }
          return s;
        });

        setStandards(updatedStandards);
        setIsGenerated(true);
        message.success(
          "Rubric criteria generated successfully! Review the table below and click Save when ready."
        );
      } else {
        message.error(message || "Failed to generate rubric");
      }

      setIsGenerating(false);
    };

    window.addEventListener(
      "rubricGenerated",
      handleRubricGenerated as EventListener
    );

    return () => {
      window.removeEventListener(
        "rubricGenerated",
        handleRubricGenerated as EventListener
      );
    };
  }, [standards]);

  // Show loading state while profile is loading
  if (isProfileLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <div>Loading profile...</div>
      </div>
    );
  }

  // Show message if no company
  if (!effectiveProfile?.company) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <div>No company assigned to your profile.</div>
      </div>
    );
  }

  // Standards are now fixed at 5 (cannot add or remove)
  // Any attempt to modify the array length will be blocked

  const updateStandard = (
    standardId: string,
    field: keyof Standard,
    value: string | string[]
  ) => {
    const updatedStandards = standards.map((s) =>
      s.id === standardId ? { ...s, [field]: value } : s
    );
    // Ensure we always have exactly 5 standards
    if (updatedStandards.length === 5) {
      setStandards(updatedStandards);
    }
  };

  const updateStandardItem = (
    standardId: string,
    itemIndex: number,
    value: string
  ) => {
    setStandards(
      standards.map((s) => {
        if (s.id === standardId) {
          const newItems = [...s.items];
          newItems[itemIndex] = value;
          return { ...s, items: newItems };
        }
        return s;
      })
    );
  };

  // Score columns are now fixed at 5 (1-5 scale)
  // Removed addScoreColumn and deleteScoreColumn functions

  const handleGenerate = async () => {
    console.log("=== GENERATE RUBRIC START ===");

    if (!rubricName.trim()) {
      message.error("Please enter a rubric name");
      return;
    }

    if (standards.length !== 5) {
      message.error("Rubric must have exactly 5 standards");
      return;
    }

    if (standards.some((s) => !s.name.trim())) {
      message.error("All standards must have a name");
      return;
    }

    console.log("Validation passed, starting AI generation...");
    setIsGenerating(true);

    try {
      // Use WebSocket to generate rubric
      emitGenerateRubric({
        rubric_name: rubricName,
        rubric_description: rubricDescription,
        standards: standards.map((s) => ({
          name: s.name,
          description: s.description,
        })),
        num_levels: standards[0]?.items?.length || 5,
      });

      console.log("Rubric generation request sent via WebSocket");
    } catch (error) {
      console.error("Error in handleGenerate:", error);
      message.error(
        `Failed to generate rubric: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    console.log("=== SAVE RUBRIC START ===");

    if (!rubricName.trim()) {
      message.error("Please enter a rubric name");
      return;
    }

    if (standards.length !== 5) {
      message.error("Rubric must have exactly 5 standards");
      return;
    }

    if (standards.some((s) => !s.name.trim())) {
      message.error("All standards must have a name");
      return;
    }

    console.log("Validation passed, starting save...");
    setIsSaving(true);

    try {
      const saveResponse = await fetch("/api/v1/rubrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: rubricName,
          description: rubricDescription,
          company: effectiveProfile?.company,
          standards: standards.map((s) => ({
            name: s.name,
            description: s.description,
            items: s.items.filter((item: string) => item.trim() !== ""),
          })),
        }),
      });

      console.log(
        "Save response received:",
        saveResponse.status,
        saveResponse.ok
      );

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        console.log("Error response:", errorData);
        throw new Error(errorData.error || "Failed to save rubric");
      }

      console.log("Success! About to show message and navigate...");
      message.success("Rubric created successfully!");

      console.log("Message shown, navigating to /admin/rubrics");
      router.push("/admin/rubrics");
      console.log("Navigation called");
    } catch (error) {
      console.error("Error in handleSave:", error);
      message.error(
        `Failed to save rubric: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      console.log("Setting isSaving to false");
      setIsSaving(false);
      console.log("=== SAVE RUBRIC END ===");
    }
  };

  const createColumns = () => {
    const scoreColumns = standards[0]?.items.map((_, index) => ({
      title: (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "40px",
              textAlign: "center",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            {index + 1}
          </div>
        </div>
      ),
      key: `score_${index}`,
      width: "15%",
      align: "center" as const,
      render: (text: string, record: Standard) => (
        <TextArea
          value={record.items[index] || ""}
          onChange={(e) => updateStandardItem(record.id, index, e.target.value)}
          placeholder={`Score ${index + 1} criteria`}
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{
            fontSize: "11px",
            border: "none",
            background: "transparent",
          }}
        />
      ),
    }));

    return [
      {
        title: (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Standards (5 Required)</span>
          </div>
        ),
        dataIndex: "name",
        key: "name",
        width: "25%",
        fixed: "left" as const,
        render: (text: string, record: Standard) => (
          <div>
            <TextArea
              value={record.name}
              onChange={(e) =>
                updateStandard(record.id, "name", e.target.value)
              }
              placeholder="Enter standard name and description here..."
              autoSize={{ minRows: 3, maxRows: 6 }}
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            />
          </div>
        ),
      },
      ...scoreColumns,
    ];
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>Create New Rubric</Title>
      </div>

      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <div>
              <Text strong>Rubric Name *</Text>
              <Input
                value={rubricName}
                onChange={(e) => setRubricName(e.target.value)}
                placeholder="Enter rubric name"
                style={{ marginTop: "4px" }}
              />
            </div>
          </Col>
          <Col span={12}>
            <div>
              <Text strong>Description</Text>
              <TextArea
                value={rubricDescription}
                onChange={(e) => setRubricDescription(e.target.value)}
                placeholder="Enter rubric description"
                style={{ marginTop: "4px" }}
                autoSize={{ minRows: 2, maxRows: 4 }}
              />
            </div>
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
          <Text type="secondary" style={{ fontSize: "12px" }}>
            Rubric requires exactly 5 standards with a fixed 1-5 scoring scale
          </Text>
        </div>

        <Table
          columns={createColumns()}
          dataSource={standards}
          pagination={false}
          rowKey="id"
          size="small"
          bordered
          style={{
            fontSize: "12px",
            width: "100%",
          }}
        />
      </Card>

      <div style={{ marginTop: "24px", textAlign: "right" }}>
        <Space>
          <Button onClick={() => router.push("/admin/rubrics")}>Cancel</Button>
          {!isGenerated ? (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={isGenerating}
            >
              {isGenerating ? "Generating with AI..." : "Generate Rubric"}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={isSaving}
            >
              {isSaving ? "Saving..." : "Save Rubric"}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}

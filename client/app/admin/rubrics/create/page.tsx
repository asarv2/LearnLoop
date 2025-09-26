"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useProfile } from "@/lib/api/hooks/useProfiles";
import { DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
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
import { useState } from "react";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Standard {
  id: string;
  name: string;
  description: string;
  items: string[];
}

export default function CreateRubricPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: currentProfile, isLoading: profileLoading } = useProfile(
    user?.id || "",
    !!user
  );

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
  const [isSaving, setIsSaving] = useState(false);

  // Show loading state while profile is loading
  if (profileLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <div>Loading profile...</div>
      </div>
    );
  }

  // Show message if no company
  if (!currentProfile?.company) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <div>No company assigned to your profile.</div>
      </div>
    );
  }

  const addStandard = () => {
    const newId = (standards.length + 1).toString();
    setStandards([
      ...standards,
      {
        id: newId,
        name: "",
        description: "",
        items: standards[0]?.items.map(() => "") || ["", "", "", "", ""],
      },
    ]);
  };

  const deleteStandard = (standardId: string) => {
    if (standards.length <= 1) {
      message.warning("At least one standard is required");
      return;
    }
    setStandards(standards.filter((s) => s.id !== standardId));
  };

  const updateStandard = (
    standardId: string,
    field: keyof Standard,
    value: string | string[]
  ) => {
    setStandards(
      standards.map((s) => (s.id === standardId ? { ...s, [field]: value } : s))
    );
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

  const addScoreColumn = () => {
    setStandards(
      standards.map((s) => ({
        ...s,
        items: [...s.items, ""],
      }))
    );
  };

  const deleteScoreColumn = (columnIndex: number) => {
    if (standards[0]?.items.length <= 1) {
      message.warning("At least one score column is required");
      return;
    }
    setStandards(
      standards.map((s) => ({
        ...s,
        items: s.items.filter((_, index) => index !== columnIndex),
      }))
    );
  };

  const handleSave = async () => {
    console.log("=== SAVE RUBRIC START ===");

    if (!rubricName.trim()) {
      message.error("Please enter a rubric name");
      return;
    }

    if (standards.some((s) => !s.name.trim())) {
      message.error("All standards must have a name");
      return;
    }

    console.log("Validation passed, starting save...");
    setIsSaving(true);

    try {
      const response = await fetch("/api/v1/rubrics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: rubricName,
          description: rubricDescription,
          company: currentProfile?.company,
          standards: standards.map((s) => ({
            name: s.name,
            description: s.description,
            items: s.items.filter((item) => item.trim() !== ""),
          })),
        }),
      });

      console.log("Response received:", response.status, response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.log("Error response:", errorData);
        throw new Error(errorData.error || "Failed to create rubric");
      }

      console.log("Success! About to show message and navigate...");
      message.success("Rubric created successfully!");

      console.log("Message shown, navigating to /admin/rubrics");
      router.push("/admin/rubrics");
      console.log("Navigation called");
    } catch (error) {
      console.error("Error in handleSave:", error);
      message.error(
        `Failed to create rubric: ${
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Input
            value={index + 1}
            onChange={(e) => {
              const newValue = parseInt(e.target.value);
              if (!isNaN(newValue) && newValue > 0) {
                // Handle reordering columns if needed
                // For now, just keep the display value
              }
            }}
            style={{
              width: "40px",
              textAlign: "center",
              fontWeight: "bold",
            }}
            size="small"
          />
          {index === standards[0]?.items.length - 1 && (
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => deleteScoreColumn(index)}
              style={{ color: "#ff4d4f" }}
            />
          )}
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
            <span>Standards</span>
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={addStandard}
              style={{ color: "#1890ff" }}
            />
          </div>
        ),
        dataIndex: "name",
        key: "name",
        width: "25%",
        fixed: "left" as const,
        render: (text: string, record: Standard, index: number) => (
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
            {index === standards.length - 1 && (
              <div style={{ marginTop: "8px" }}>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => deleteStandard(record.id)}
                  style={{ color: "#ff4d4f" }}
                >
                  Delete
                </Button>
              </div>
            )}
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
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addScoreColumn}
          >
            Add Score Column
          </Button>
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
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={isSaving}
          >
            Save Rubric
          </Button>
        </Space>
      </div>
    </div>
  );
}

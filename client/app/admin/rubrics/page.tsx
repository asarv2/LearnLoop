"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useProfile } from "@/lib/api/hooks/useProfiles";
import { useRubrics, useRubricStandards } from "@/lib/api/hooks/useRubrics";
import {
  CheckSquareOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const { Title, Text } = Typography;
const { Search } = Input;

export default function AdminRubricsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: currentProfile, isLoading: profileLoading } = useProfile(
    user?.id || "",
    !!user
  );
  const {
    data: rubrics,
    isLoading: rubricsLoading,
    refetch: refetchRubrics,
  } = useRubrics(currentProfile?.company || null);

  // Refetch rubrics when the page loads to ensure fresh data
  useEffect(() => {
    if (currentProfile?.company) {
      refetchRubrics();
    }
  }, [currentProfile?.company, refetchRubrics]);

  const [searchText, setSearchText] = useState("");
  const [selectedRubricId, setSelectedRubricId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingRubricId, setDeletingRubricId] = useState<string | null>(null);

  const { data: rubricDetails, isLoading: detailsLoading } =
    useRubricStandards(selectedRubricId);

  const handleRubricClick = (rubricId: string) => {
    setSelectedRubricId(rubricId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRubricId(null);
  };

  const handleDeleteRubric = async (rubricId: string) => {
    setDeletingRubricId(rubricId);
    try {
      const response = await fetch(`/api/v1/rubrics/${rubricId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete rubric");
      }

      message.success("Rubric deleted successfully");
      // Refresh the rubrics list by refetching
      await refetchRubrics();
    } catch (error) {
      console.error("Error deleting rubric:", error);
      message.error(
        `Failed to delete rubric: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setDeletingRubricId(null);
    }
  };

  // Filter rubrics based on search
  const filteredRubrics =
    rubrics?.filter(
      (rubric) =>
        rubric.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (rubric.description &&
          rubric.description.toLowerCase().includes(searchText.toLowerCase()))
    ) || [];

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

  // Create rubric table columns (1-5 scoring)
  const rubricColumns = [
    {
      title: "Standard",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>{text}</div>
          {record.description && (
            <div style={{ color: "#666", fontSize: "12px" }}>
              {record.description}
            </div>
          )}
        </div>
      ),
      width: "25%",
      fixed: "left" as const,
    },
    {
      title: "1",
      key: "score_1",
      width: "15%",
      align: "center" as const,
      render: (text: any, record: any) => (
        <div
          style={{
            fontSize: "11px",
            lineHeight: "1.3",
            padding: "8px 4px",
            backgroundColor:
              record.items && record.items[0] ? "#fff2f0" : "#fafafa",
            borderRadius: "4px",
            minHeight: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {record.items && record.items[0] ? record.items[0] : "-"}
        </div>
      ),
    },
    {
      title: "2",
      key: "score_2",
      width: "15%",
      align: "center" as const,
      render: (text: any, record: any) => (
        <div
          style={{
            fontSize: "11px",
            lineHeight: "1.3",
            padding: "8px 4px",
            backgroundColor:
              record.items && record.items[1] ? "#fff7e6" : "#fafafa",
            borderRadius: "4px",
            minHeight: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {record.items && record.items[1] ? record.items[1] : "-"}
        </div>
      ),
    },
    {
      title: "3",
      key: "score_3",
      width: "15%",
      align: "center" as const,
      render: (text: any, record: any) => (
        <div
          style={{
            fontSize: "11px",
            lineHeight: "1.3",
            padding: "8px 4px",
            backgroundColor:
              record.items && record.items[2] ? "#f6ffed" : "#fafafa",
            borderRadius: "4px",
            minHeight: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {record.items && record.items[2] ? record.items[2] : "-"}
        </div>
      ),
    },
    {
      title: "4",
      key: "score_4",
      width: "15%",
      align: "center" as const,
      render: (text: any, record: any) => (
        <div
          style={{
            fontSize: "11px",
            lineHeight: "1.3",
            padding: "8px 4px",
            backgroundColor:
              record.items && record.items[3] ? "#e6f7ff" : "#fafafa",
            borderRadius: "4px",
            minHeight: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {record.items && record.items[3] ? record.items[3] : "-"}
        </div>
      ),
    },
    {
      title: "5",
      key: "score_5",
      width: "15%",
      align: "center" as const,
      render: (text: any, record: any) => (
        <div
          style={{
            fontSize: "11px",
            lineHeight: "1.3",
            padding: "8px 4px",
            backgroundColor:
              record.items && record.items[4] ? "#f0f5ff" : "#fafafa",
            borderRadius: "4px",
            minHeight: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {record.items && record.items[4] ? record.items[4] : "-"}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>Rubric Management</Title>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "24px" }}>
        <Search
          placeholder="Search rubrics..."
          allowClear
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* Rubrics Grid */}
      <Row gutter={[24, 24]}>
        {/* Create New Rubric Card */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card
            hoverable
            style={{
              height: "200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px dashed #d9d9d9",
              background: "#fafafa",
              cursor: "pointer",
            }}
            styles={{
              body: {
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              },
            }}
            onClick={() => router.push("/admin/rubrics/create")}
          >
            <PlusOutlined
              style={{
                fontSize: "48px",
                color: "#1890ff",
                marginBottom: "16px",
              }}
            />
            <Text strong style={{ color: "#1890ff" }}>
              Create New Rubric
            </Text>
          </Card>
        </Col>

        {/* Rubric Cards */}
        {filteredRubrics.map((rubric) => (
          <Col key={rubric.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{
                height: "200px",
                cursor: "pointer",
                position: "relative",
              }}
              styles={{
                body: {
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                },
              }}
              onClick={() => handleRubricClick(rubric.id)}
            >
              {/* Delete button for company rubrics only */}
              {rubric.company && (
                <div
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    zIndex: 10,
                  }}
                >
                  <Popconfirm
                    title="Delete Rubric"
                    description="Are you sure you want to delete this rubric? This action cannot be undone."
                    onConfirm={() => handleDeleteRubric(rubric.id)}
                    okText="Yes"
                    cancelText="No"
                    placement="topLeft"
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      size="small"
                      loading={deletingRubricId === rubric.id}
                      style={{
                        color: "#ff4d4f",
                      }}
                    />
                  </Popconfirm>
                </div>
              )}

              <div style={{ flex: 1 }}>
                <Title
                  level={4}
                  style={{ marginBottom: "8px", fontSize: "16px" }}
                >
                  {rubric.name}
                </Title>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  {rubric.description || "No description available"}
                </Text>
              </div>
              <div style={{ marginTop: "16px" }}>
                <Space>
                  <Tag icon={<CheckSquareOutlined />} color="blue">
                    {rubric.standard_length || 0} standards
                  </Tag>
                  <Tag color="green">{rubric.total_points || 0} points</Tag>
                </Space>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Empty State */}
      {!rubricsLoading && filteredRubrics.length === 0 && (
        <div style={{ marginTop: "50px" }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                {rubrics?.length === 0
                  ? "No rubrics found for your company."
                  : "No rubrics match your search."}
              </span>
            }
          />
        </div>
      )}

      {/* Rubric Details Modal */}
      <Modal
        title={rubricDetails?.rubric.name || "Rubric Details"}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={[
          <Button key="close" onClick={handleCloseModal}>
            Close
          </Button>,
        ]}
        width="95vw"
        style={{ top: 20 }}
        styles={{
          body: { maxHeight: "85vh", overflow: "hidden" },
        }}
      >
        {detailsLoading ? (
          <div style={{ textAlign: "center", padding: "50px" }}>
            <div>Loading rubric details...</div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: "16px", textAlign: "center" }}>
              <Text strong style={{ fontSize: "14px" }}>
                Scoring Guide: 1 = Poor, 2 = Below Average, 3 = Average, 4 =
                Good, 5 = Excellent
              </Text>
            </div>
            <Table
              columns={rubricColumns}
              dataSource={rubricDetails?.standards || []}
              pagination={false}
              rowKey="id"
              size="small"
              bordered
              style={{
                fontSize: "12px",
                width: "100%",
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

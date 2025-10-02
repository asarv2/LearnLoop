"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Popconfirm,
  Row,
  Typography,
  Upload,
  message,
} from "antd";
import { useEffect, useMemo, useState } from "react";

const { Title, Paragraph } = Typography;
const { Search } = Input;

type Policy = {
  id: string;
  title: string;
  description: string | null;
  file_key: string | null;
  created_at: string | null;
  company: string;
};

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [search, setSearch] = useState("");
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch("/api/v1/policies", { cache: "no-store" });
        const data = await res.json();
        if (Array.isArray(data)) setPolicies(data as Policy[]);
      } catch (error) {
        console.error("Error fetching policies:", error);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
    );
  }, [policies, search]);

  const handleDeletePolicy = async (policyId: string) => {
    setDeletingPolicyId(policyId);
    try {
      const response = await fetch(`/api/v1/policies/${policyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete policy");
      }

      message.success("Policy deleted successfully");
      // Refresh the policies list
      const res = await fetch("/api/v1/policies", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) setPolicies(data as Policy[]);
    } catch (error) {
      console.error("Error deleting policy:", error);
      message.error(
        `Failed to delete policy: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setDeletingPolicyId(null);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 24,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Policies
        </Title>
        <Paragraph style={{ margin: 0, color: "#666" }}>
          Upload and manage your company policies and documents. These files
          help the AI understand your organization’s unique guidelines, enabling
          it to simulate realistic employee interactions during training and
          reinforce company policies and best practices.
        </Paragraph>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Search
          placeholder="Search policies..."
          allowClear
          style={{ width: 320 }}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Upload
            name="file"
            multiple={false}
            showUploadList={false}
            customRequest={async (options) => {
              const { file, onSuccess, onError } = options as {
                file: File;
                onSuccess?: (response: unknown, file: File) => void;
                onError?: (error: Error) => void;
              };
              try {
                // 1) Create placeholder policy row
                const createRes = await fetch("/api/v1/policies", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: (file as File).name }),
                });
                const created = await createRes.json();
                if (!createRes.ok)
                  throw new Error(created?.error || "Failed to create policy");

                // 2) Upload file
                const form = new FormData();
                form.set("file", file as File);
                const uploadRes = await fetch(
                  `/api/v1/policies/${created.id}/upload`,
                  {
                    method: "POST",
                    body: form,
                  }
                );
                const uploaded = await uploadRes.json();
                if (!uploadRes.ok)
                  throw new Error(uploaded?.error || "Failed to upload file");

                // 3) Refresh list
                const listRes = await fetch("/api/v1/policies", {
                  cache: "no-store",
                });
                const listData = await listRes.json();
                setPolicies(Array.isArray(listData) ? listData : []);
                onSuccess?.(uploaded, file);
              } catch (e) {
                onError?.(e as Error);
              }
            }}
          >
            <Card
              hoverable
              style={{
                height: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "all 0.3s ease",
                border: "2px dashed #d9d9d9",
                backgroundColor: "#fafafa",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    background:
                      "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    fontSize: 24,
                    boxShadow: "0 4px 12px rgba(24, 144, 255, 0.3)",
                  }}
                >
                  <PlusOutlined />
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 16,
                    marginBottom: 4,
                    color: "#262626",
                  }}
                >
                  Upload new document
                </div>
                <div style={{ color: "#8c8c8c", fontSize: 13 }}>
                  PDF, DOCX, PPTX…
                </div>
              </div>
            </Card>
          </Upload>
        </Col>

        {filtered.length === 0 && (
          <Col span={24}>
            <Card>
              <Empty description="No policies yet" />
            </Card>
          </Col>
        )}

        {filtered.map((p) => (
          <Col key={p.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              onClick={() =>
                window.open(`/api/v1/policies/${p.id}/file`, "_blank")
              }
              style={{
                height: 200,
                cursor: "pointer",
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "all 0.3s ease",
                position: "relative",
              }}
              bodyStyle={{
                padding: 20,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Delete button */}
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
                  title="Delete Policy"
                  description="Are you sure you want to delete this policy? This action cannot be undone."
                  onConfirm={() => handleDeletePolicy(p.id)}
                  okText="Yes"
                  cancelText="No"
                  placement="topLeft"
                >
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    size="small"
                    loading={deletingPolicyId === p.id}
                    style={{
                      color: "#ff4d4f",
                    }}
                  />
                </Popconfirm>
              </div>

              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 16,
                    marginBottom: 8,
                    color: "#262626",
                    lineHeight: 1.4,
                  }}
                >
                  {p.title}
                </div>
                {p.description && (
                  <div
                    style={{
                      color: "#8c8c8c",
                      fontSize: 13,
                      lineHeight: 1.4,
                      marginBottom: 12,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.description}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "auto",
                  paddingTop: 12,
                  borderTop: "1px solid #f0f0f0",
                }}
              >
                <div
                  style={{
                    color: "#8c8c8c",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {new Date(p.created_at || Date.now()).toLocaleDateString()}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

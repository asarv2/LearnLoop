"use client";

import AddUsersModal from "@/components/admin/AddUsersModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/fetcher";
import { PlusOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Input,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// Employee data types
interface EmployeeRecord {
  id: string;
  name: string;
  role: string;
  company: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_active: string | null;
  training_completed_count?: number;
  average_score?: number;
}

// Function to fetch employees by company
async function fetchEmployeesByCompany(
  company: string | null
): Promise<EmployeeRecord[]> {
  if (!company) return [];

  try {
    const response = await api<EmployeeRecord[]>(
      `/api/v1/employees?company=${encodeURIComponent(company)}`
    );
    return response;
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    return [];
  }
}

// Function to fetch employee training statistics
async function fetchEmployeeTrainingStats(
  company: string | null
): Promise<Record<string, { completed_count: number; average_score: number }>> {
  if (!company) return {};

  try {
    const response = await api<
      Record<string, { completed_count: number; average_score: number }>
    >(`/api/v1/employee-training-stats?company=${encodeURIComponent(company)}`);
    return response;
  } catch (error) {
    console.error("Failed to fetch employee training stats:", error);
    return {};
  }
}

// Create columns function that takes training stats
const createColumns = (
  trainingStats: Record<
    string,
    { completed_count: number; average_score: number }
  >
) => [
  {
    title: "Employee",
    dataIndex: "name",
    key: "name",
    width: 200,
    render: (text: string, record: EmployeeRecord) => (
      <Space>
        <Avatar icon={<UserOutlined />} />
        <div>
          <div style={{ fontWeight: "bold" }}>{text}</div>
          <div style={{ color: "#666", fontSize: "12px" }}>
            {record.role.toUpperCase()}
          </div>
        </div>
      </Space>
    ),
  },
  {
    title: "Trainings Completed",
    key: "trainings_completed",
    width: 150,
    render: (_: unknown, record: EmployeeRecord) => {
      const stats = trainingStats[record.id];
      const count = stats?.completed_count || 0;
      return (
        <div style={{ textAlign: "center" }}>
          <div
            style={{ fontSize: "18px", fontWeight: "bold", color: "#1890ff" }}
          >
            {count}
          </div>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            completed
          </Text>
        </div>
      );
    },
  },
  {
    title: "Average Score",
    key: "average_score",
    width: 150,
    render: (_: unknown, record: EmployeeRecord) => {
      const stats = trainingStats[record.id];
      const score = stats?.average_score || 0;
      return (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color:
                score >= 80 ? "#52c41a" : score >= 60 ? "#fa8c16" : "#ff4d4f",
            }}
          >
            {score > 0 ? `${Math.round(score)}%` : "N/A"}
          </div>
          <Text type="secondary" style={{ fontSize: "12px" }}>
            average
          </Text>
        </div>
      );
    },
  },
  {
    title: "Last Active",
    dataIndex: "last_active",
    key: "last_active",
    width: 150,
    render: (lastActive: string | null) => {
      if (!lastActive) {
        return <Text type="secondary">Never</Text>;
      }
      const date = dayjs(lastActive);
      const now = dayjs();
      const diffDays = now.diff(date, "day");

      if (diffDays === 0) {
        return <Text style={{ color: "#52c41a" }}>Today</Text>;
      } else if (diffDays === 1) {
        return <Text style={{ color: "#fa8c16" }}>Yesterday</Text>;
      } else if (diffDays < 7) {
        return <Text>{diffDays} days ago</Text>;
      } else {
        return <Text type="secondary">{date.format("MMM DD, YYYY")}</Text>;
      }
    },
  },
];

export default function AdminEmployeesPage() {
  const { effectiveProfile } = useAuth();
  const [, contextHolder] = message.useMessage();

  // State for filters
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // State for Add Users modal
  const [addUsersModalOpen, setAddUsersModalOpen] = useState(false);

  // Fetch employees data
  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", effectiveProfile?.company],
    queryFn: () => fetchEmployeesByCompany(effectiveProfile?.company || null),
    enabled: !!effectiveProfile?.company,
    staleTime: 5 * 60_000, // 5 minutes
  });

  // Fetch training statistics
  const { data: trainingStats } = useQuery({
    queryKey: ["employee-training-stats", effectiveProfile?.company],
    queryFn: () =>
      fetchEmployeeTrainingStats(effectiveProfile?.company || null),
    enabled: !!effectiveProfile?.company,
    staleTime: 5 * 60_000, // 5 minutes
  });

  // Filter employees
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];

    let filtered = employees;

    // Search filter
    if (searchText) {
      filtered = filtered.filter((employee) =>
        employee.name.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      filtered = filtered.filter((employee) => employee.role === roleFilter);
    }

    return filtered.sort((a, b) => {
      // Sort by last active (most recent first)
      const aLastActive = a.last_active ? new Date(a.last_active).getTime() : 0;
      const bLastActive = b.last_active ? new Date(b.last_active).getTime() : 0;
      return bLastActive - aLastActive;
    });
  }, [employees, searchText, roleFilter]);

  const columns = createColumns(trainingStats || {});

  return (
    <div>
      {contextHolder}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Employee Management
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddUsersModalOpen(true)}
        >
          Add Users
        </Button>
      </div>

      <Card>
        <div
          style={{
            marginBottom: "16px",
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <Search
            placeholder="Search employees..."
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="Filter by role"
            style={{ width: 150 }}
            value={roleFilter}
            onChange={setRoleFilter}
          >
            <Option value="all">All Roles</Option>
            <Option value="superadmin">Superadmin</Option>
            <Option value="admin">Admin</Option>
            <Option value="employee">Employee</Option>
          </Select>
        </div>
        <Table
          columns={columns}
          dataSource={filteredEmployees}
          loading={isLoading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} employees`,
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Add Users Modal */}
      <AddUsersModal
        open={addUsersModalOpen}
        onClose={() => setAddUsersModalOpen(false)}
        company={effectiveProfile?.company || ""}
        currentPlan="starter"
      />
    </div>
  );
}

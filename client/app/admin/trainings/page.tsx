"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/fetcher";
import { useTrainingsByTypeAndCompany } from "@/lib/api/hooks/useTrainings";
import { Training } from "@/types";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tooltip,
  Typography,
  message,
} from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Training data types
// Using Training type from @/types

// Completion data types
interface CompletionData {
  training_id: string;
  completed_count: number;
  total_company_employees: number;
  completion_rate: number;
}

// Function to fetch completion rates for trainings
async function fetchCompletionRates(
  company: string | null
): Promise<CompletionData[]> {
  if (!company) return [];

  try {
    const response = await api<CompletionData[]>(
      `/api/v1/training-completion?company=${encodeURIComponent(company)}`
    );
    return response;
  } catch (error) {
    console.error("Failed to fetch completion rates:", error);
    return [];
  }
}

// Employee details types
interface EmployeeDetail {
  id: string;
  name: string;
  completedAt?: string;
  assignedAt?: string;
}

interface EmployeeDetailsData {
  completed: EmployeeDetail[];
  pending: EmployeeDetail[];
  total_employees: number;
  completed_count: number;
  pending_count: number;
}

// Function to fetch detailed employee data for a training
async function fetchEmployeeDetails(
  trainingId: string,
  company: string
): Promise<EmployeeDetailsData> {
  try {
    const response = await api<EmployeeDetailsData>(
      `/api/v1/training-employees?training_id=${trainingId}&company=${encodeURIComponent(
        company
      )}`
    );
    return response;
  } catch (error) {
    console.error("Failed to fetch employee details:", error);
    return {
      completed: [],
      pending: [],
      total_employees: 0,
      completed_count: 0,
      pending_count: 0,
    };
  }
}

// Import the new unified TrainingComponent
import TrainingComponent from "@/components/training/TrainingComponent";

// Edit Training Modal using the new unified component
function EditTrainingModal({
  visible,
  onClose,
  training,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  training: Partial<Training> | null;
}) {
  const handleSuccess = () => {
    onSaved();
    onClose();
  };

  return (
    <TrainingComponent
      training_id={training?.id}
      editingTraining={
        training?.id
          ? {
              id: training.id,
              title: training.title || "",
              description: training.description,
              training_type: training.training_type,
              active: training.active,
              due_date: training.due_date,
            }
          : null
      }
      custom={training?.training_type === "custom"}
      asModal={true}
      visible={visible}
      onCancel={onClose}
      onSuccess={handleSuccess}
      title="Edit Training"
      showGuidelines={false}
    />
  );
}

// Employee completion tracking modal
function EmployeeCompletionModal({
  visible,
  onClose,
  training,
}: {
  visible: boolean;
  onClose: () => void;
  training: Partial<Training> | null;
}) {
  const [employeeDetails, setEmployeeDetails] =
    useState<EmployeeDetailsData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch detailed employee data when modal opens
  useEffect(() => {
    if (visible && training && training.company && training.id) {
      setLoadingDetails(true);
      fetchEmployeeDetails(training.id, training.company)
        .then(setEmployeeDetails)
        .finally(() => setLoadingDetails(false));
    }
  }, [visible, training]);

  // Use real employee data
  const completedEmployees = employeeDetails?.completed || [];
  const pendingEmployees = employeeDetails?.pending || [];
  const completedCount = employeeDetails?.completed_count || 0;
  // const totalEmployees = employeeDetails?.total_employees || 0;
  const pendingCount = employeeDetails?.pending_count || 0;

  return (
    <Modal
      title={`Employee Progress: ${training?.title || ""}`}
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={800}
    >
      <div style={{ marginBottom: "24px" }}>
        <Row gutter={16}>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="Completed"
                value={completedCount}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="Pending"
                value={pendingCount}
                prefix={<UserOutlined />}
                valueStyle={{ color: "#fa8c16" }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <Title level={5} style={{ color: "#52c41a" }}>
          Completed ({completedCount})
        </Title>
        {loadingDetails ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Text type="secondary">Loading employee details...</Text>
          </div>
        ) : (
          completedEmployees.map((employee) => (
            <div
              key={employee.id}
              style={{
                padding: "8px 12px",
                backgroundColor: "#f6ffed",
                border: "1px solid #b7eb8f",
                borderRadius: "4px",
                marginBottom: "4px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{employee.name}</span>
              <Text type="secondary">
                Completed: {dayjs(employee.completedAt).format("MMM DD, YYYY")}
              </Text>
            </div>
          ))
        )}
      </div>

      <div>
        <Title level={5} style={{ color: "#fa8c16" }}>
          Pending ({pendingCount})
        </Title>
        {loadingDetails ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Text type="secondary">Loading employee details...</Text>
          </div>
        ) : (
          pendingEmployees.map((employee) => (
            <div
              key={employee.id}
              style={{
                padding: "8px 12px",
                backgroundColor: "#fff7e6",
                border: "1px solid #ffd591",
                borderRadius: "4px",
                marginBottom: "4px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{employee.name}</span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

export default function AdminTrainingsPage() {
  const { effectiveProfile } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();
  const queryClient = useQueryClient();

  // Function to toggle training active status
  const toggleTrainingStatus = async (
    trainingId: string,
    currentStatus: boolean
  ) => {
    try {
      await api(`/api/v1/trainings/${trainingId}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !currentStatus }),
      });

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["trainings"] });
      queryClient.invalidateQueries({ queryKey: ["training-completion"] });

      messageApi.success(
        `Training ${!currentStatus ? "activated" : "deactivated"} successfully`
      );
    } catch (error) {
      console.error("Failed to toggle training status:", error);
      messageApi.error("Failed to update training status. Please try again.");
    }
  };

  // Function to delete training
  const deleteTraining = async (trainingId: string, trainingTitle: string) => {
    try {
      await api(`/api/v1/trainings/${trainingId}`, {
        method: "DELETE",
      });

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["trainings"] });
      queryClient.invalidateQueries({ queryKey: ["training-completion"] });

      messageApi.success(`Training "${trainingTitle}" deleted successfully`);
    } catch (error) {
      console.error("Failed to delete training:", error);
      messageApi.error("Failed to delete training. Please try again.");
    }
  };

  // State for filters and search
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);
  const [selectedTraining, setSelectedTraining] =
    useState<Partial<Training> | null>(null);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Fetch only required trainings data
  const { data: requiredTrainings, isLoading } = useTrainingsByTypeAndCompany(
    "required",
    effectiveProfile?.company || null
  );

  // Fetch completion rates
  const { data: completionRates, isLoading: loadingCompletion } = useQuery({
    queryKey: ["training-completion", effectiveProfile?.company],
    queryFn: () => fetchCompletionRates(effectiveProfile?.company || null),
    enabled: !!effectiveProfile?.company,
    staleTime: 2 * 60_000, // 2 minutes
  });

  // Only show required trainings
  const allTrainings = useMemo(() => {
    return requiredTrainings || [];
  }, [requiredTrainings]);

  // Create completion rate lookup
  const completionLookup = useMemo(() => {
    const lookup: Record<string, CompletionData> = {};
    completionRates?.forEach((completion) => {
      lookup[completion.training_id] = completion;
    });
    return lookup;
  }, [completionRates]);

  // Filter and search trainings
  const filteredTrainings = useMemo(() => {
    let filtered = allTrainings;

    // Search filter
    if (searchText) {
      filtered = filtered.filter(
        (training) =>
          training.title.toLowerCase().includes(searchText.toLowerCase()) ||
          (training.description &&
            training.description
              .toLowerCase()
              .includes(searchText.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((training) => {
        if (statusFilter === "active") return training.active === true;
        if (statusFilter === "inactive") return training.active === false;
        return true;
      });
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(
        (training) => training.training_type === typeFilter
      );
    }

    // Date range filter
    if (dateRange && dateRange[0] && dateRange[1]) {
      filtered = filtered.filter((training) => {
        const createdAt = dayjs(training.created_at);
        return (
          createdAt.isAfter(dateRange[0]) && createdAt.isBefore(dateRange[1])
        );
      });
    }

    return filtered.sort(
      (a, b) => dayjs(b.updated_at).unix() - dayjs(a.updated_at).unix()
    );
  }, [allTrainings, searchText, statusFilter, typeFilter, dateRange]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalTrainings = allTrainings.length;
    const activeTrainings = allTrainings.filter(
      (t) => t.active === true
    ).length;
    const requiredTrainingsCount = allTrainings.filter(
      (t) => t.training_type === "required"
    ).length;
    const overdueDue = allTrainings.filter((t) => {
      if (!t.due_date || t.training_type !== "required") return false;
      return dayjs().isAfter(dayjs(t.due_date));
    }).length;

    // Calculate average completion rate
    const totalCompletionRate =
      completionRates?.reduce(
        (sum, completion) => sum + completion.completion_rate,
        0
      ) || 0;
    const avgCompletionRate = completionRates?.length
      ? Math.round(totalCompletionRate / completionRates.length)
      : 0;

    return {
      totalTrainings,
      activeTrainings,
      requiredTrainingsCount,
      overdueDue,
      avgCompletionRate,
    };
  }, [allTrainings, completionRates]);

  // Table columns
  const columns: ColumnsType<Partial<Training>> = [
    {
      title: "Training Name",
      dataIndex: "title",
      key: "title",
      width: 250,
      render: (text: string, record: Partial<Training>) => (
        <div>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>{text}</div>
          {record.description && (
            <div style={{ color: "#666", fontSize: "12px", lineHeight: "1.4" }}>
              {record.description.length > 80
                ? `${record.description.substring(0, 80)}...`
                : record.description}
            </div>
          )}
          {record.due_date && (
            <div style={{ marginTop: "4px" }}>
              <CalendarOutlined
                style={{ color: "#fa8c16", marginRight: "4px" }}
              />
              <Text type="secondary" style={{ fontSize: "11px" }}>
                Due: {dayjs(record.due_date).format("MMM DD, YYYY")}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_, record: Partial<Training>) => (
        <div>
          <div
            style={{
              color: record.active ? "#52c41a" : "#ff4d4f",
              fontWeight: "bold",
            }}
          >
            {record.active ? "Active" : "Inactive"}
          </div>
        </div>
      ),
    },
    {
      title: "Completion Rate",
      key: "completion_rate",
      width: 150,
      render: (_, record: Partial<Training>) => {
        const completion = record.id ? completionLookup[record.id] : undefined;
        if (!completion) {
          return (
            <span style={{ color: "#999" }}>
              {loadingCompletion ? "Loading..." : "No data"}
            </span>
          );
        }

        const rate = completion.completion_rate;
        return (
          <div>
            <div
              style={{
                color:
                  rate >= 80 ? "#52c41a" : rate >= 60 ? "#fa8c16" : "#ff4d4f",
                fontWeight: "bold",
              }}
            >
              {rate}%
            </div>
            <div style={{ fontSize: "11px", color: "#666" }}>
              {completion.completed_count} of{" "}
              {completion.total_company_employees} employees
            </div>
          </div>
        );
      },
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (date: string) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_, record: Partial<Training>) => (
        <Space size="small">
          <Tooltip title="Edit Training">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => {
                setSelectedTraining(record);
                setEditModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="View Employee Progress">
            <Button
              type="text"
              icon={<TeamOutlined />}
              size="small"
              onClick={() => {
                setSelectedTraining(record);
                setEmployeeModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title={record.active ? "Deactivate" : "Activate"}>
            <Button
              type="text"
              size="small"
              style={{ color: record.active ? "#fa8c16" : "#52c41a" }}
              onClick={() => {
                if (record.id) {
                  toggleTrainingStatus(record.id, record.active || false);
                }
              }}
            >
              {record.active ? "Deactivate" : "Activate"}
            </Button>
          </Tooltip>
          <Popconfirm
            title="Delete Training"
            description={`Are you sure you want to delete "${record.title}"?`}
            onConfirm={() => {
              if (record.id) {
                deleteTraining(record.id, record.title || "");
              }
            }}
            okText="Delete"
            cancelText="Cancel"
            okType="danger"
          >
            <Tooltip title="Delete Training">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
                disabled={!record.id}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Training Management
        </Title>
      </div>

      {/* KPI Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total Trainings"
              value={kpis.totalTrainings}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Active Trainings"
              value={kpis.activeTrainings}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Required Trainings"
              value={kpis.requiredTrainingsCount}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Avg Completion Rate"
              value={kpis.avgCompletionRate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color:
                  kpis.avgCompletionRate >= 80
                    ? "#52c41a"
                    : kpis.avgCompletionRate >= 60
                    ? "#fa8c16"
                    : "#ff4d4f",
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: "24px" }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="Search trainings..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Type"
              value={typeFilter}
              onChange={setTypeFilter}
            >
              <Select.Option value="all">All Types</Select.Option>
              <Select.Option value="standard">Standard</Select.Option>
              <Select.Option value="required">Required</Select.Option>
              <Select.Option value="custom">Custom</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              style={{ width: "100%" }}
              placeholder={["Start Date", "End Date"]}
              value={dateRange}
              onChange={setDateRange}
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => {
                setSearchText("");
                setStatusFilter("all");
                setTypeFilter("all");
                setDateRange(null);
              }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Training Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredTrainings}
          loading={isLoading || loadingCompletion}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} trainings`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Edit Training Modal */}
      <EditTrainingModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedTraining(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["trainings"] });
          queryClient.invalidateQueries({
            queryKey: ["training-completion"],
          });
        }}
        training={selectedTraining}
      />

      {/* Employee Completion Modal */}
      <EmployeeCompletionModal
        visible={employeeModalVisible}
        onClose={() => {
          setEmployeeModalVisible(false);
          setSelectedTraining(null);
        }}
        training={selectedTraining}
      />

      {/* Floating Action Button */}
      <Link href="/admin/trainings/create">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            height: "auto",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontWeight: 500,
          }}
        >
          Create Training
        </Button>
      </Link>
    </div>
  );
}

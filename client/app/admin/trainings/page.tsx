"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api/fetcher";
import { useProfile } from "@/lib/api/hooks/useProfiles";
import { useTrainingsByTypeAndCompany } from "@/lib/api/hooks/useTrainings";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilterOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Modal,
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
import { useEffect, useMemo, useState } from "react";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Training data types
interface TrainingRecord {
  id: string;
  title: string;
  description?: string | null;
  training_type?: string | null;
  active?: boolean | null;
  due_date?: string | null;
  company?: string | null;
  created_at: string;
  updated_at: string;
  user_id?: string | null;
}

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

// Training Details Modal
function TrainingDetailsModal({
  visible,
  onClose,
  training,
}: {
  visible: boolean;
  onClose: () => void;
  training: TrainingRecord | null;
}) {
  return (
    <Modal
      title="Training Details"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={600}
    >
      {training && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <Text strong>Training Name:</Text>
            <div style={{ marginTop: "4px" }}>
              <Text>{training.title}</Text>
            </div>
          </div>

          <div>
            <Text strong>Description:</Text>
            <div style={{ marginTop: "4px" }}>
              <Text>{training.description || "No description provided"}</Text>
            </div>
          </div>

          {training.due_date && (
            <div>
              <Text strong>Due Date:</Text>
              <div style={{ marginTop: "4px" }}>
                <CalendarOutlined
                  style={{ marginRight: "8px", color: "#fa8c16" }}
                />
                <Text>{dayjs(training.due_date).format("MMMM DD, YYYY")}</Text>
              </div>
            </div>
          )}

          <div>
            <Text strong>Created:</Text>
            <div style={{ marginTop: "4px" }}>
              <Text>
                {dayjs(training.created_at).format("MMMM DD, YYYY [at] h:mm A")}
              </Text>
            </div>
          </div>

          <div>
            <Text strong>Last Updated:</Text>
            <div style={{ marginTop: "4px" }}>
              <Text>
                {dayjs(training.updated_at).format("MMMM DD, YYYY [at] h:mm A")}
              </Text>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// Employee completion tracking modal
function EmployeeCompletionModal({
  visible,
  onClose,
  training,
  completion,
}: {
  visible: boolean;
  onClose: () => void;
  training: TrainingRecord | null;
  completion: CompletionData | null;
}) {
  const [employeeDetails, setEmployeeDetails] =
    useState<EmployeeDetailsData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch detailed employee data when modal opens
  useEffect(() => {
    if (visible && training && training.company) {
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
  const totalEmployees = employeeDetails?.total_employees || 0;
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
  const { user } = useAuth();
  const { data: currentProfile } = useProfile(user?.id || "", !!user);
  const [messageApi, contextHolder] = message.useMessage();

  // State for filters and search
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);
  const [selectedTraining, setSelectedTraining] =
    useState<TrainingRecord | null>(null);
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [trainingDetailsVisible, setTrainingDetailsVisible] = useState(false);

  // Fetch only required trainings data
  const { data: requiredTrainings, isLoading } = useTrainingsByTypeAndCompany(
    "required",
    currentProfile?.company || null
  );

  // Fetch completion rates
  const { data: completionRates, isLoading: loadingCompletion } = useQuery({
    queryKey: ["training-completion", currentProfile?.company],
    queryFn: () => fetchCompletionRates(currentProfile?.company || null),
    enabled: !!currentProfile?.company,
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
  const columns: ColumnsType<TrainingRecord> = [
    {
      title: "Training Name",
      dataIndex: "title",
      key: "title",
      width: 250,
      render: (text: string, record: TrainingRecord) => (
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
      title: "Completion Rate",
      key: "completion_rate",
      width: 150,
      render: (_, record: TrainingRecord) => {
        const completion = completionLookup[record.id];
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
      render: (_, record: TrainingRecord) => (
        <Space size="small">
          <Tooltip title="View Training Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => {
                setSelectedTraining(record);
                setTrainingDetailsVisible(true);
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
                messageApi.info(
                  `Training ${record.active ? "deactivated" : "activated"}`
                );
              }}
            >
              {record.active ? "Deactivate" : "Activate"}
            </Button>
          </Tooltip>
          <Tooltip title="Delete Training">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={() => {
                Modal.confirm({
                  title: "Delete Training",
                  content: `Are you sure you want to delete "${record.title}"?`,
                  okText: "Delete",
                  okType: "danger",
                  onOk: () => {
                    messageApi.success("Training deleted successfully");
                  },
                });
              }}
            />
          </Tooltip>
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

      {/* Training Details Modal */}
      <TrainingDetailsModal
        visible={trainingDetailsVisible}
        onClose={() => {
          setTrainingDetailsVisible(false);
          setSelectedTraining(null);
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
        completion={
          selectedTraining ? completionLookup[selectedTraining.id] : null
        }
      />
    </div>
  );
}

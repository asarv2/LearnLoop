"use client";

import {
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

const employeeData = [
  {
    key: "1",
    name: "Alexander Siladlie",
    email: "alexander@company.com",
    role: "superadmin",
    department: "Engineering",
    status: "active",
    lastActive: "2024-01-15",
    trainingProgress: 85,
  },
  {
    key: "2",
    name: "Ashok Saravanan",
    email: "ashok@company.com",
    role: "superadmin",
    department: "Engineering",
    status: "active",
    lastActive: "2024-01-14",
    trainingProgress: 92,
  },
  {
    key: "3",
    name: "John Doe",
    email: "john@company.com",
    role: "employee",
    department: "Sales",
    status: "active",
    lastActive: "2024-01-13",
    trainingProgress: 67,
  },
  {
    key: "4",
    name: "Jane Smith",
    email: "jane@company.com",
    role: "employee",
    department: "Marketing",
    status: "inactive",
    lastActive: "2024-01-10",
    trainingProgress: 45,
  },
];

const columns = [
  {
    title: "Employee",
    dataIndex: "name",
    key: "name",
    render: (text: string, record: Record<string, unknown>) => (
      <Space>
        <Avatar icon={<UserOutlined />} />
        <div>
          <div style={{ fontWeight: "bold" }}>{text}</div>
          <div style={{ color: "#666", fontSize: "12px" }}>
            {String(record.email)}
          </div>
        </div>
      </Space>
    ),
  },
  {
    title: "Role",
    dataIndex: "role",
    key: "role",
    render: (role: string) => (
      <Tag
        color={
          role === "superadmin" ? "purple" : role === "admin" ? "blue" : "green"
        }
      >
        {role.toUpperCase()}
      </Tag>
    ),
  },
  {
    title: "Department",
    dataIndex: "department",
    key: "department",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Tag color={status === "active" ? "green" : "red"}>
        {status.toUpperCase()}
      </Tag>
    ),
  },
  {
    title: "Training Progress",
    dataIndex: "trainingProgress",
    key: "trainingProgress",
    render: (progress: number) => (
      <div>
        <div
          style={{
            width: "100%",
            backgroundColor: "#f0f0f0",
            borderRadius: "4px",
            height: "8px",
            marginBottom: "4px",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              backgroundColor:
                progress >= 80
                  ? "#52c41a"
                  : progress >= 60
                  ? "#fa8c16"
                  : "#ff4d4f",
              height: "100%",
              borderRadius: "4px",
            }}
          />
        </div>
        <span style={{ fontSize: "12px", color: "#666" }}>{progress}%</span>
      </div>
    ),
  },
  {
    title: "Last Active",
    dataIndex: "lastActive",
    key: "lastActive",
  },
  {
    title: "Actions",
    key: "actions",
    render: () => (
      <Space size="small">
        <Button type="text" icon={<EditOutlined />} size="small">
          Edit
        </Button>
        <Button type="text" icon={<MailOutlined />} size="small">
          Message
        </Button>
        <Button type="text" icon={<DeleteOutlined />} size="small" danger>
          Deactivate
        </Button>
      </Space>
    ),
  },
];

export default function AdminEmployeesPage() {
  return (
    <div>
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
        <Button type="primary" icon={<PlusOutlined />}>
          Add Employee
        </Button>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#1890ff",
                }}
              >
                4
              </div>
              <div style={{ color: "#666" }}>Total Employees</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#52c41a",
                }}
              >
                3
              </div>
              <div style={{ color: "#666" }}>Active</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#fa8c16",
                }}
              >
                72%
              </div>
              <div style={{ color: "#666" }}>Avg. Progress</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#722ed1",
                }}
              >
                2
              </div>
              <div style={{ color: "#666" }}>Admins</div>
            </div>
          </Card>
        </Col>
      </Row>

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
          />
          <Select placeholder="Filter by role" style={{ width: 150 }}>
            <Option value="all">All Roles</Option>
            <Option value="superadmin">Superadmin</Option>
            <Option value="admin">Admin</Option>
            <Option value="employee">Employee</Option>
          </Select>
          <Select placeholder="Filter by status" style={{ width: 150 }}>
            <Option value="all">All Status</Option>
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
          </Select>
        </div>
        <Table
          columns={columns}
          dataSource={employeeData}
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}

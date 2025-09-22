"use client";

import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";

const { Title } = Typography;
const { Search } = Input;

const documentData = [
  {
    key: "1",
    name: "Company Handbook 2024",
    type: "PDF",
    size: "2.4 MB",
    uploadedBy: "Alexander Siladlie",
    uploadDate: "2024-01-15",
    status: "active",
  },
  {
    key: "2",
    name: "Training Guidelines",
    type: "DOCX",
    size: "1.8 MB",
    uploadedBy: "Ashok Saravanan",
    uploadDate: "2024-01-14",
    status: "active",
  },
  {
    key: "3",
    name: "Safety Procedures",
    type: "PDF",
    size: "3.2 MB",
    uploadedBy: "Alexander Siladlie",
    uploadDate: "2024-01-13",
    status: "archived",
  },
];

const columns = [
  {
    title: "Document Name",
    dataIndex: "name",
    key: "name",
    render: (text: string) => <div style={{ fontWeight: "bold" }}>{text}</div>,
  },
  {
    title: "Type",
    dataIndex: "type",
    key: "type",
    render: (type: string) => (
      <Tag color={type === "PDF" ? "red" : "blue"}>{type}</Tag>
    ),
  },
  {
    title: "Size",
    dataIndex: "size",
    key: "size",
  },
  {
    title: "Uploaded By",
    dataIndex: "uploadedBy",
    key: "uploadedBy",
  },
  {
    title: "Upload Date",
    dataIndex: "uploadDate",
    key: "uploadDate",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
    render: (status: string) => (
      <Tag color={status === "active" ? "green" : "orange"}>
        {status.toUpperCase()}
      </Tag>
    ),
  },
  {
    title: "Actions",
    key: "actions",
    render: () => (
      <Space size="small">
        <Button type="text" icon={<EyeOutlined />} size="small">
          View
        </Button>
        <Button type="text" icon={<DownloadOutlined />} size="small">
          Download
        </Button>
        <Button type="text" icon={<EditOutlined />} size="small">
          Edit
        </Button>
        <Button type="text" icon={<DeleteOutlined />} size="small" danger>
          Delete
        </Button>
      </Space>
    ),
  },
];

export default function AdminDocumentsPage() {
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
          Document Management
        </Title>
        <Upload>
          <Button type="primary" icon={<UploadOutlined />}>
            Upload Document
          </Button>
        </Upload>
      </div>

      <Row gutter={[24, 24]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#1890ff",
                }}
              >
                3
              </div>
              <div style={{ color: "#666" }}>Total Documents</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#52c41a",
                }}
              >
                2
              </div>
              <div style={{ color: "#666" }}>Active</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#fa8c16",
                }}
              >
                1
              </div>
              <div style={{ color: "#666" }}>Archived</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#722ed1",
                }}
              >
                7.4 MB
              </div>
              <div style={{ color: "#666" }}>Total Size</div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: "16px" }}>
          <Search
            placeholder="Search documents..."
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
          />
        </div>
        <Table
          columns={columns}
          dataSource={documentData}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}

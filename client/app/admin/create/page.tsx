"use client";

import { PlusOutlined, SaveOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Typography,
} from "antd";

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function AdminCreatePage() {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log("Form values:", values);
    // Handle form submission
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Create New Content
      </Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Training Creation" style={{ marginBottom: "24px" }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                type: "training",
                status: "draft",
              }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Content Type"
                    name="type"
                    rules={[
                      { required: true, message: "Please select content type" },
                    ]}
                  >
                    <Select>
                      <Option value="training">Training</Option>
                      <Option value="scenario">Scenario</Option>
                      <Option value="rubric">Rubric</Option>
                      <Option value="document">Document</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Status"
                    name="status"
                    rules={[
                      { required: true, message: "Please select status" },
                    ]}
                  >
                    <Select>
                      <Option value="draft">Draft</Option>
                      <Option value="active">Active</Option>
                      <Option value="inactive">Inactive</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Title"
                name="title"
                rules={[{ required: true, message: "Please enter title" }]}
              >
                <Input placeholder="Enter title" />
              </Form.Item>

              <Form.Item
                label="Description"
                name="description"
                rules={[
                  { required: true, message: "Please enter description" },
                ]}
              >
                <TextArea rows={4} placeholder="Enter description" />
              </Form.Item>

              <Form.Item label="Instructions" name="instructions">
                <TextArea rows={6} placeholder="Enter detailed instructions" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                  >
                    Save
                  </Button>
                  <Button icon={<PlusOutlined />}>Save & Create Another</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Quick Actions" style={{ marginBottom: "24px" }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button block icon={<PlusOutlined />}>
                Create Training
              </Button>
              <Button block icon={<PlusOutlined />}>
                Create Scenario
              </Button>
              <Button block icon={<PlusOutlined />}>
                Create Rubric
              </Button>
              <Button block icon={<PlusOutlined />}>
                Upload Document
              </Button>
            </Space>
          </Card>

          <Card title="Recent Creations">
            <div
              style={{ color: "#666", textAlign: "center", padding: "20px" }}
            >
              No recent creations
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

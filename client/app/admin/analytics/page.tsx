"use client";

import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Statistic, Typography } from "antd";

const { Title } = Typography;

export default function AdminAnalyticsPage() {
  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Analytics Dashboard
      </Title>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Employees"
              value={156}
              prefix={<UserOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Trainings"
              value={3}
              prefix={<BookOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completed Sessions"
              value={(1, 234)}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg. Session Time"
              value={24}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: "24px" }}>
        <Col xs={24} lg={12}>
          <Card title="Training Completion Rates" style={{ height: "400px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "300px",
                color: "#666",
              }}
            >
              Chart placeholder - Training completion rates over time
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Employee Performance" style={{ height: "400px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "300px",
                color: "#666",
              }}
            >
              Chart placeholder - Employee performance metrics
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: "24px" }}>
        <Col xs={24}>
          <Card title="Recent Activity" style={{ height: "300px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "200px",
                color: "#666",
              }}
            >
              Activity feed placeholder - Recent training sessions and
              completions
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

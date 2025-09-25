"use client";

import { useAnalytics } from "@/lib/api/hooks/useAnalytics";
import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Card, Col, Row, Spin, Statistic, Typography } from "antd";

const { Title } = Typography;

export default function AdminAnalyticsPage() {
  const { data: analytics, isLoading, error } = useAnalytics();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "400px",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error loading analytics"
        description="Failed to load analytics data. Please try again."
        type="error"
        showIcon
      />
    );
  }

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
              value={analytics?.totalEmployees || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Trainings"
              value={analytics?.activeTrainings || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completed Sessions"
              value={analytics?.completedSessions || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg. Session Time"
              value={analytics?.avgSessionTime || 0}
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
            <div style={{ height: "300px", overflowY: "auto" }}>
              {analytics?.companyTrainingStats &&
              Object.keys(analytics.companyTrainingStats).length > 0 ? (
                <div>
                  {Object.entries(analytics.companyTrainingStats).map(
                    ([company, trainings]) => (
                      <div key={company} style={{ marginBottom: "16px" }}>
                        <h4 style={{ margin: "0 0 8px 0", color: "#1890ff" }}>
                          {company}
                        </h4>
                        {Object.entries(trainings).map(
                          ([trainingName, stats]) => {
                            const completionRate =
                              stats.total > 0
                                ? Math.round(
                                    (stats.completed / stats.total) * 100
                                  )
                                : 0;
                            return (
                              <div
                                key={trainingName}
                                style={{
                                  marginBottom: "8px",
                                  padding: "8px",
                                  backgroundColor: "#f5f5f5",
                                  borderRadius: "4px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span style={{ fontWeight: 500 }}>
                                    {trainingName}
                                  </span>
                                  <span
                                    style={{
                                      color:
                                        completionRate >= 80
                                          ? "#52c41a"
                                          : completionRate >= 60
                                          ? "#fa8c16"
                                          : "#ff4d4f",
                                    }}
                                  >
                                    {completionRate}%
                                  </span>
                                </div>
                                <div
                                  style={{ fontSize: "12px", color: "#666" }}
                                >
                                  {stats.completed} of {stats.total} completed
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    color: "#666",
                  }}
                >
                  No training data available
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Employee Performance" style={{ height: "400px" }}>
            <div style={{ height: "300px", overflowY: "auto" }}>
              <div style={{ textAlign: "center", marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#1890ff",
                  }}
                >
                  {analytics?.avgPerformanceScore || 0}
                </div>
                <div style={{ color: "#666" }}>Average Performance Score</div>
              </div>

              {analytics?.employees && analytics.employees.length > 0 ? (
                <div>
                  <h4 style={{ margin: "0 0 12px 0" }}>Employees by Company</h4>
                  {Object.entries(
                    analytics.employees.reduce((acc, emp) => {
                      const company = emp.company || "No Company";
                      if (!acc[company]) acc[company] = [];
                      acc[company].push(emp);
                      return acc;
                    }, {} as Record<string, typeof analytics.employees>)
                  ).map(([company, employees]) => (
                    <div key={company} style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          fontWeight: 500,
                          color: "#1890ff",
                          marginBottom: "4px",
                        }}
                      >
                        {company} ({employees.length})
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {employees.map((emp) => emp.name).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    color: "#666",
                  }}
                >
                  No employee data available
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: "24px" }}>
        <Col xs={24}>
          <Card title="Recent Activity" style={{ height: "300px" }}>
            <div style={{ height: "200px", overflowY: "auto" }}>
              {analytics?.recentActivity &&
              analytics.recentActivity.length > 0 ? (
                <div>
                  {analytics.recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #f0f0f0",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: "4px" }}>
                          {activity.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666" }}>
                          Completed by {activity.profiles.name}
                          {activity.profiles.company &&
                            ` (${activity.profiles.company})`}
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {new Date(activity.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    color: "#666",
                  }}
                >
                  No recent activity
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

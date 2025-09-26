"use client";

import { useAnalytics } from "@/lib/api/hooks/useAnalytics";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Card,
  Col,
  Row,
  Select,
  Spin,
  Statistic,
  Typography,
} from "antd";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const { Title } = Typography;
const { Option } = Select;

export default function AdminAnalyticsPage() {
  const { data: analytics, isLoading, error } = useAnalytics();
  const [timeFilter, setTimeFilter] = useState<"30days" | "ytd">("30days");
  const [mainTrainingType, setMainTrainingType] = useState<
    "all" | "standard" | "required" | "custom"
  >("all");
  const [standardFilter, setStandardFilter] = useState<"cumulative" | string>(
    "cumulative"
  );
  const [requiredFilter, setRequiredFilter] = useState<"cumulative" | string>(
    "cumulative"
  );

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

  // Helper function to generate continuous date range
  const generateDateRange = (start: Date, end: Date, isMonthly = false) => {
    const dates = [];
    const current = new Date(start);

    while (current <= end) {
      if (isMonthly) {
        dates.push(
          current.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
          })
        );
        current.setMonth(current.getMonth() + 1);
      } else {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    }
    return dates;
  };

  // Filter and process chart data based on selected filters
  const getFilteredChartData = () => {
    if (!analytics?.trainingSpecificData) return [];

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // Determine date range and filtering
    let startDate: Date;
    const endDate = now;
    let isMonthly = false;

    if (timeFilter === "ytd") {
      startDate = new Date(now.getFullYear(), 0, 1);
      isMonthly = true;
    } else {
      startDate = thirtyDaysAgo;
    }

    // Filter training data based on main training type and sub-filters
    const filteredTrainingData = analytics.trainingSpecificData.filter(
      (item) => {
        const itemDate = new Date(item.date);
        if (itemDate < startDate || itemDate > endDate) return false;

        // Filter based on main training type selection
        if (mainTrainingType === "all") {
          return true; // Show all training types
        } else if (mainTrainingType === "standard") {
          if (item.trainingType !== "standard") return false;
          if (standardFilter === "cumulative") return true;
          return item.trainingId === standardFilter;
        } else if (mainTrainingType === "required") {
          if (item.trainingType !== "required") return false;
          if (requiredFilter === "cumulative") return true;
          return item.trainingId === requiredFilter;
        } else if (mainTrainingType === "custom") {
          return item.trainingType === "custom";
        }

        return false;
      }
    );

    // Generate continuous date range
    const dateRange = generateDateRange(startDate, endDate, isMonthly);

    // Create data points for each date, filling in 0s where no data exists
    const processedData = dateRange.map((dateStr) => {
      const relevantData = filteredTrainingData.filter((item) => {
        if (isMonthly) {
          const itemMonth = new Date(item.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
          });
          return itemMonth === dateStr;
        } else {
          return item.date.split("T")[0] === dateStr;
        }
      });

      const averageScore =
        relevantData.length > 0
          ? Math.round(
              relevantData.reduce((sum, item) => sum + item.score, 0) /
                relevantData.length
            )
          : 0;

      return {
        date: dateStr,
        averageScore,
        completions: relevantData.length,
      };
    });

    return processedData;
  };

  // Generate dynamic chart title based on filters
  const getChartTitle = () => {
    const timeText =
      timeFilter === "30days" ? "Last 30 Days" : "Year to Date by Month";

    if (mainTrainingType === "all") {
      return `Performance Trends - All Trainings (${timeText})`;
    } else if (mainTrainingType === "standard") {
      if (standardFilter === "cumulative") {
        return `Performance Trends - All Standard Trainings (${timeText})`;
      } else {
        const trainingName =
          analytics?.trainingsByType?.standard?.find(
            (t) => t.id === standardFilter
          )?.title || "Unknown";
        return `Performance Trends - ${trainingName} (${timeText})`;
      }
    } else if (mainTrainingType === "required") {
      if (requiredFilter === "cumulative") {
        return `Performance Trends - All Required Trainings (${timeText})`;
      } else {
        const trainingName =
          analytics?.trainingsByType?.required?.find(
            (t) => t.id === requiredFilter
          )?.title || "Unknown";
        return `Performance Trends - ${trainingName} (${timeText})`;
      }
    } else if (mainTrainingType === "custom") {
      return `Performance Trends - All Custom Trainings (${timeText})`;
    }

    return `Performance Trends (${timeText})`;
  };

  return (
    <div>
      <Title level={2} style={{ marginBottom: "24px" }}>
        Performance Analytics
      </Title>

      {/* Key Performance Indicators */}
      <Row gutter={[24, 24]} style={{ marginBottom: "32px" }}>
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
              title="Avg Performance Score"
              value={analytics?.avgPerformanceScore || 0}
              suffix="/100"
              prefix={<TrophyOutlined />}
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
              title="Avg Session Time"
              value={analytics?.avgSessionTime || 0}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12} md={8}>
          <Card size="small">
            <div style={{ marginBottom: "8px", fontWeight: 500 }}>
              Time Period
            </div>
            <Select
              value={timeFilter}
              onChange={setTimeFilter}
              style={{ width: "100%" }}
              placeholder="Select time period"
            >
              <Option value="30days">Last 30 Days</Option>
              <Option value="ytd">Year to Date (by Month)</Option>
            </Select>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={16}>
          <Card size="small">
            <div style={{ marginBottom: "8px", fontWeight: 500 }}>
              Training Filters
            </div>
            <Row gutter={[8, 8]}>
              <Col xs={24} sm={12}>
                <div
                  style={{
                    marginBottom: "4px",
                    fontSize: "12px",
                    color: "#666",
                  }}
                >
                  Training Type
                </div>
                <Select
                  value={mainTrainingType}
                  onChange={setMainTrainingType}
                  style={{ width: "100%" }}
                  size="small"
                >
                  <Option value="all">All Training Types</Option>
                  <Option value="standard">Standard Trainings</Option>
                  <Option value="required">Required Trainings</Option>
                  <Option value="custom">Custom Trainings</Option>
                </Select>
              </Col>

              {mainTrainingType === "standard" && (
                <Col xs={24} sm={12}>
                  <div
                    style={{
                      marginBottom: "4px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Standard Training Selection
                  </div>
                  <Select
                    value={standardFilter}
                    onChange={setStandardFilter}
                    style={{ width: "100%" }}
                    size="small"
                  >
                    <Option value="cumulative">
                      All Standard (Cumulative)
                    </Option>
                    {analytics?.trainingsByType?.standard &&
                    analytics.trainingsByType.standard.length > 0 ? (
                      analytics.trainingsByType.standard.map((training) => (
                        <Option key={training.id} value={training.id}>
                          {training.title}
                        </Option>
                      ))
                    ) : (
                      <Option disabled value="">
                        No standard trainings available
                      </Option>
                    )}
                  </Select>
                </Col>
              )}

              {mainTrainingType === "required" && (
                <Col xs={24} sm={12}>
                  <div
                    style={{
                      marginBottom: "4px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Required Training Selection
                  </div>
                  <Select
                    value={requiredFilter}
                    onChange={setRequiredFilter}
                    style={{ width: "100%" }}
                    size="small"
                  >
                    <Option value="cumulative">
                      All Required (Cumulative)
                    </Option>
                    {analytics?.trainingsByType?.required &&
                    analytics.trainingsByType.required.length > 0 ? (
                      analytics.trainingsByType.required.map((training) => (
                        <Option key={training.id} value={training.id}>
                          {training.title}
                        </Option>
                      ))
                    ) : (
                      <Option disabled value="">
                        No required trainings available
                      </Option>
                    )}
                  </Select>
                </Col>
              )}

              {mainTrainingType === "custom" && (
                <Col xs={24} sm={12}>
                  <div
                    style={{
                      marginBottom: "4px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Custom Training Display
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "4px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    Showing cumulative custom training scores
                  </div>
                </Col>
              )}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Performance Chart */}
      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card title={getChartTitle()} style={{ height: "500px" }}>
            <div style={{ height: "420px" }}>
              {getFilteredChartData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getFilteredChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        if (timeFilter === "ytd") {
                          return value; // Already formatted as "Dec 2024"
                        }
                        return new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(value) => {
                        if (timeFilter === "ytd") {
                          return `Month: ${value}`;
                        }
                        return `Date: ${new Date(value).toLocaleDateString()}`;
                      }}
                      formatter={(value, name) => [
                        name === "averageScore" ? `${value}/100` : value,
                        name === "averageScore" ? "Avg Score" : "Completions",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageScore"
                      stroke="#1890ff"
                      strokeWidth={3}
                      dot={{ fill: "#1890ff", strokeWidth: 2, r: 6 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
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
                  No performance data available for the selected period
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

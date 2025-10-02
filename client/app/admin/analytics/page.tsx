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
  Bar,
  BarChart,
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
              (relevantData.reduce((sum, item) => sum + item.score, 0) /
                relevantData.length) *
                4
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

  // Generate score distribution histogram data
  const getScoreDistribution = () => {
    if (!analytics?.trainingSpecificData) return [];

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let startDate: Date;
    const endDate = now;

    if (timeFilter === "ytd") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = thirtyDaysAgo;
    }

    // Filter data similar to main chart
    const filteredData = analytics.trainingSpecificData.filter((item) => {
      const itemDate = new Date(item.date);
      if (itemDate < startDate || itemDate > endDate) return false;

      if (mainTrainingType === "all") {
        return true;
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
    });

    // Create score buckets
    const buckets = {
      "0-20%": 0,
      "20-40%": 0,
      "40-60%": 0,
      "60-80%": 0,
      "80-100%": 0,
    };

    filteredData.forEach((item) => {
      const score = item.score * 4; // Scale from 25-point to 100-point scale
      if (score >= 0 && score < 20) buckets["0-20%"]++;
      else if (score >= 20 && score < 40) buckets["20-40%"]++;
      else if (score >= 40 && score < 60) buckets["40-60%"]++;
      else if (score >= 60 && score < 80) buckets["60-80%"]++;
      else if (score >= 80 && score <= 100) buckets["80-100%"]++;
    });

    const scoreDistributionData = Object.entries(buckets).map(
      ([range, count]) => ({
        range,
        count,
      })
    );

    return scoreDistributionData;
  };

  // Generate training effectiveness vs completion analysis
  const getTrainingEffectiveness = () => {
    if (!analytics?.trainingSpecificData || !analytics?.companyTrainingStats)
      return [];

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    let startDate: Date;
    const endDate = now;

    if (timeFilter === "ytd") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = thirtyDaysAgo;
    }

    // Filter data similar to main chart
    const filteredData = analytics.trainingSpecificData.filter((item) => {
      const itemDate = new Date(item.date);
      if (itemDate < startDate || itemDate > endDate) return false;

      if (mainTrainingType === "all") {
        return true;
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
    });

    // Group by training and calculate metrics
    const trainingMetrics = filteredData.reduce((acc, item) => {
      // For custom trainings, group them all together instead of by individual title
      const groupKey =
        item.trainingType === "custom"
          ? "All Custom Training Sessions"
          : item.trainingTitle;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          scores: [],
          completions: 0,
          type: item.trainingType,
        };
      }
      acc[groupKey].scores.push(item.score);
      acc[groupKey].completions++;
      return acc;
    }, {} as Record<string, { scores: number[]; completions: number; type: string }>);

    // Calculate effectiveness metrics for each training
    const effectivenessData = Object.entries(trainingMetrics).map(
      ([title, data]) => {
        const avgScore =
          data.scores.length > 0
            ? Math.round(
                (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) *
                  4
              )
            : 0;

        // Get completion rate from company stats (if available)
        let completionRate = 0;
        Object.values(analytics.companyTrainingStats || {}).forEach(
          (companyTrainings) => {
            if (companyTrainings[title]) {
              const stats = companyTrainings[title];
              completionRate =
                stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : 0;
            }
          }
        );

        // Determine priority level for L&D action
        let priority = "Monitor";
        if (avgScore < 60 && completionRate < 60) {
          priority = "Critical"; // Low score, low completion - needs major revision
        } else if (avgScore < 60) {
          priority = "Improve Content"; // Low score but people complete it - content issue
        } else if (completionRate < 60) {
          priority = "Boost Adoption"; // Good content but low completion - engagement issue
        } else if (avgScore >= 80 && completionRate >= 80) {
          priority = "Expand/Replicate"; // High performance, high adoption - success story
        }

        return {
          training: title.length > 15 ? title.substring(0, 15) + "..." : title,
          fullTitle: title,
          avgScore,
          completionRate,
          priority,
          type: data.type,
          totalCompletions: data.completions,
        };
      }
    );

    // Get available trainings based on the selected filter
    let relevantTrainings: {
      id: string;
      title: string;
      training_type: string;
    }[] = [];

    if (mainTrainingType === "all") {
      relevantTrainings = [
        ...(analytics.trainingsByType?.standard || []),
        ...(analytics.trainingsByType?.required || []),
        ...(analytics.trainingsByType?.custom || []),
      ];
    } else if (mainTrainingType === "standard") {
      if (standardFilter === "cumulative") {
        relevantTrainings = analytics.trainingsByType?.standard || [];
      } else {
        // Individual training selected
        const selectedTraining = analytics.trainingsByType?.standard?.find(
          (t) => t.id === standardFilter
        );
        relevantTrainings = selectedTraining ? [selectedTraining] : [];
      }
    } else if (mainTrainingType === "required") {
      if (requiredFilter === "cumulative") {
        relevantTrainings = analytics.trainingsByType?.required || [];
      } else {
        // Individual training selected
        const selectedTraining = analytics.trainingsByType?.required?.find(
          (t) => t.id === requiredFilter
        );
        relevantTrainings = selectedTraining ? [selectedTraining] : [];
      }
    } else if (mainTrainingType === "custom") {
      // For custom, show all custom trainings as one group
      relevantTrainings = analytics.trainingsByType?.custom || [];
    }

    // Create entries for trainings with 0 completions
    const trainingsWithZeroCompletions = relevantTrainings
      .filter((training) => {
        // Check if this training has any data in effectivenessData
        const hasData = effectivenessData.some(
          (item) =>
            item.fullTitle === training.title ||
            (training.training_type === "custom" &&
              item.fullTitle === "All Custom Training Sessions")
        );
        return !hasData;
      })
      .map((training) => ({
        training:
          training.training_type === "custom"
            ? "Custom Training"
            : training.title.length > 15
            ? training.title.substring(0, 15) + "..."
            : training.title,
        fullTitle:
          training.training_type === "custom"
            ? "All Custom Training Sessions"
            : training.title,
        avgScore: 0,
        completionRate: 0,
        priority: "No Completions",
        type: training.training_type,
        totalCompletions: 0,
      }));

    // Combine data with completions and trainings with 0 completions
    const allEffectivenessData = [
      ...effectivenessData,
      ...trainingsWithZeroCompletions,
    ];

    return allEffectivenessData
      .sort((a, b) => {
        // Sort by priority: Critical first, then by score, then No Completions last
        const priorityOrder = {
          Critical: 0,
          "Improve Content": 1,
          "Boost Adoption": 2,
          Monitor: 3,
          "Expand/Replicate": 4,
          "No Completions": 5,
        };
        return (
          priorityOrder[a.priority as keyof typeof priorityOrder] -
          priorityOrder[b.priority as keyof typeof priorityOrder]
        );
      })
      .slice(0, 8); // Show top 8 trainings
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
              value={(analytics?.avgPerformanceScore || 0) * 4}
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
                ></div>
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
                  ></div>
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
                  ></div>
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
                  ></div>
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

      {/* Additional Charts - Score Distribution and Training Frequency */}
      <Row gutter={[24, 24]} style={{ marginTop: "24px" }}>
        <Col xs={24} lg={12}>
          <Card title="Score Distribution" style={{ height: "400px" }}>
            <div style={{ height: "320px" }}>
              {getScoreDistribution().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getScoreDistribution()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [value, "Count"]}
                      labelFormatter={(label) => `Score Range: ${label}`}
                    />
                    <Bar dataKey="count" fill="#1890ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
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
                  No score data available for the selected period
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Score vs Completion Rate" style={{ height: "400px" }}>
            <div style={{ height: "320px" }}>
              {getTrainingEffectiveness().length > 0 ? (
                <div style={{ height: "100%", overflowY: "auto" }}>
                  {getTrainingEffectiveness().map((training) => {
                    const priorityColors = {
                      Critical: "#ff4d4f",
                      "Improve Content": "#fa8c16",
                      "Boost Adoption": "#faad14",
                      Monitor: "#722ed1",
                      "Expand/Replicate": "#52c41a",
                      "No Completions": "#8c8c8c",
                    };

                    return (
                      <div
                        key={training.fullTitle}
                        style={{
                          padding: "12px",
                          marginBottom: "8px",
                          backgroundColor: "#fafafa",
                          borderRadius: "6px",
                          borderLeft: `4px solid ${
                            priorityColors[
                              training.priority as keyof typeof priorityColors
                            ]
                          }`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "13px" }}>
                            {training.fullTitle}
                          </div>
                          <div
                            style={{
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 500,
                              backgroundColor:
                                priorityColors[
                                  training.priority as keyof typeof priorityColors
                                ],
                              color: "white",
                            }}
                          >
                            {training.priority}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "12px",
                            color: "#666",
                          }}
                        >
                          <span>
                            Avg Score:{" "}
                            <strong
                              style={{
                                color:
                                  training.avgScore >= 80
                                    ? "#52c41a"
                                    : training.avgScore >= 60
                                    ? "#faad14"
                                    : "#ff4d4f",
                              }}
                            >
                              {training.avgScore}/100
                            </strong>
                          </span>
                          <span>
                            Completion:{" "}
                            <strong
                              style={{
                                color:
                                  training.completionRate >= 80
                                    ? "#52c41a"
                                    : training.completionRate >= 60
                                    ? "#faad14"
                                    : "#ff4d4f",
                              }}
                            >
                              {training.completionRate}%
                            </strong>
                          </span>
                          <span>
                            Type:{" "}
                            <strong>
                              {training.type.charAt(0).toUpperCase() +
                                training.type.slice(1)}
                            </strong>
                          </span>
                        </div>

                        {training.priority === "Critical" && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#ff4d4f",
                              marginTop: "4px",
                              fontStyle: "italic",
                            }}
                          >
                            Requires immediate attention - consider redesigning
                            content
                          </div>
                        )}
                        {training.priority === "Improve Content" && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#fa8c16",
                              marginTop: "4px",
                              fontStyle: "italic",
                            }}
                          >
                            Review content quality and difficulty level
                          </div>
                        )}
                        {training.priority === "Boost Adoption" && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#faad14",
                              marginTop: "4px",
                              fontStyle: "italic",
                            }}
                          >
                            Improve marketing and accessibility of this training
                          </div>
                        )}
                        {training.priority === "Expand/Replicate" && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#52c41a",
                              marginTop: "4px",
                              fontStyle: "italic",
                            }}
                          >
                            Success story - consider expanding or replicating
                          </div>
                        )}
                        {training.priority === "No Completions" && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#8c8c8c",
                              marginTop: "4px",
                              fontStyle: "italic",
                            }}
                          >
                            No training sessions completed yet - consider
                            promoting this training
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  No training effectiveness data available for the selected
                  period
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

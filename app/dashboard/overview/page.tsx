"use client";

import React, { useMemo } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Progress, 
  List, 
  Button,
  Space,
  Divider,
  Tag
} from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getChats } from '@/utils/queries/chats/get-all-chats';
import { Chat } from '@/types';

const { Title, Text } = Typography;

export default function OverviewPage() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: () => getChats(),
  });

  // Sort sessions by newest first
  const sortedSessions = useMemo(() => 
    sessions?.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || [], [sessions]
  );

  // Calculate progress metrics
  const progressMetrics = useMemo(() => {
    const totalSessions = sortedSessions.length;
    const completedSessions = sortedSessions.filter(session => session.completed_at).length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const thisMonthSessions = sortedSessions.filter(session => 
      new Date(session.created_at) >= thisMonth
    ).length;
    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setDate(1);
    const lastMonthSessions = sortedSessions.filter(session => {
      const sessionDate = new Date(session.created_at);
      return sessionDate >= lastMonth && sessionDate < thisMonth;
    }).length;
    
    const monthOverMonth = lastMonthSessions > 0 
      ? ((thisMonthSessions - lastMonthSessions) / lastMonthSessions) * 100 
      : 0;

    return {
      totalSessions,
      completedSessions,
      completionRate,
      thisMonthSessions,
      lastMonthSessions,
      monthOverMonth
    };
  }, [sortedSessions]);

  // Calculate performance trends
  const performanceTrends = useMemo(() => {
    const completedSessions = sortedSessions.filter(session => session.completed_at);
    const recentSessions = completedSessions.slice(0, 5);
    
    const avgDuration = completedSessions.length > 0 
      ? completedSessions.reduce((acc, session) => {
        const start = new Date(session.created_at);
        const end = new Date(session.completed_at);
        return acc + (end.getTime() - start.getTime());
      }, 0) / completedSessions.length / (1000 * 60)
      : 0;

    return {
      recentSessions,
      avgDuration: Math.round(avgDuration)
    };
  }, [sortedSessions]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusTag = (chat: Chat) => {
    if (chat.completed_at) {
      return <Tag color="success" icon={<CheckCircleOutlined />}>Completed</Tag>;
    }
    return <Tag color="processing" icon={<ClockCircleOutlined />}>In Progress</Tag>;
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text>Loading dashboard...</Text>
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ marginBottom: '24px' }}>
        Training Simulations Dashboard
      </Title>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Sessions"
              value={progressMetrics.totalSessions}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Completed"
              value={progressMetrics.completedSessions}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="This Month"
              value={progressMetrics.thisMonthSessions}
              prefix={progressMetrics.monthOverMonth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              suffix={`${Math.abs(progressMetrics.monthOverMonth).toFixed(1)}%`}
              valueStyle={{ 
                color: progressMetrics.monthOverMonth >= 0 ? '#52c41a' : '#ff4d4f' 
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg Duration"
              value={performanceTrends.avgDuration}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Progress Overview */}
        <Col xs={24} lg={12}>
          <Card title="Progress Overview" extra={<TrophyOutlined />}>
            <div style={{ marginBottom: '24px' }}>
              <Text strong>Completion Rate</Text>
              <Progress 
                percent={Math.round(progressMetrics.completionRate)} 
                strokeColor={{
                  '0%': '#1890ff',
                  '100%': '#722ed1',
                }}
                style={{ marginTop: '8px' }}
              />
            </div>
            
            <Row gutter={16}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Statistic
                  title="Completed"
                  value={progressMetrics.completedSessions}
                  valueStyle={{ color: '#52c41a', fontSize: '24px' }}
                />
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Statistic
                  title="In Progress"
                  value={progressMetrics.totalSessions - progressMetrics.completedSessions}
                  valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                />
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Statistic
                  title="Avg Minutes"
                  value={performanceTrends.avgDuration}
                  valueStyle={{ color: '#722ed1', fontSize: '24px' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Recent Activity */}
        <Col xs={24} lg={12}>
          <Card 
            title="Recent Activity" 
            extra={
              <Link href="/dashboard/history">
                <Button type="link">View All</Button>
              </Link>
            }
          >
            {performanceTrends.recentSessions.length > 0 ? (
              <List
                dataSource={performanceTrends.recentSessions.slice(0, 5)}
                renderItem={(session) => (
                                      <List.Item
                      actions={[
                        <Link key="view" href={`/training/${session.training_type || 'interview'}/c/${session.id}`}>
                          <Button 
                            type="text" 
                            icon={<PlayCircleOutlined />}
                            size="small"
                          >
                            Review
                          </Button>
                        </Link>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{session.title || 'Untitled Session'}</Text>
                            {getStatusTag(session)}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={4}>
                            <Text type="secondary">{session.name || 'Unknown Participant'}</Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {formatDate(session.created_at)}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">No recent activity</Text>
                <br />
                <Link href="/dashboard/trainings">
                  <Button type="primary" style={{ marginTop: '16px' }}>
                    Start First Simulation
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </Col>
      </Row>

              {/* Analytics Section */}
        {sortedSessions.length > 0 && (
        <>
          <Divider style={{ margin: '32px 0' }} />
          <Title level={3} style={{ marginBottom: '24px' }}>
            Analytics
          </Title>
          
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Training Types Distribution">
                <div>
                  {['interview', 'offboarding'].map((trainingType) => {
                    const count = sortedSessions.filter(session => (session.training_type || 'interview') === trainingType).length;
                    const percentage = sortedSessions.length > 0 ? (count / sortedSessions.length) * 100 : 0;
                    
                    return (
                      <div key={trainingType} style={{ marginBottom: '16px' }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <Space>
                            <Tag color={trainingType === 'interview' ? 'blue' : 'orange'}>
                              {trainingType.toUpperCase()}
                            </Tag>
                            <Text>{trainingType.charAt(0).toUpperCase() + trainingType.slice(1)} Training</Text>
                          </Space>
                          <Text type="secondary">
                            {count} ({percentage.toFixed(1)}%)
                          </Text>
                        </div>
                        <Progress 
                          percent={Math.round(percentage)} 
                          showInfo={false}
                          strokeColor={trainingType === 'interview' ? '#1890ff' : '#fa8c16'}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Monthly Trends">
                <Row gutter={16} style={{ marginBottom: '24px' }}>
                  <Col span={12} style={{ textAlign: 'center' }}>
                    <Statistic
                      title="This Month"
                      value={progressMetrics.thisMonthSessions}
                      valueStyle={{ color: '#fa8c16', fontSize: '32px' }}
                    />
                  </Col>
                  <Col span={12} style={{ textAlign: 'center' }}>
                    <Statistic
                      title="Last Month"
                      value={progressMetrics.lastMonthSessions}
                      valueStyle={{ color: '#1890ff', fontSize: '32px' }}
                    />
                  </Col>
                </Row>
                
                <div style={{ textAlign: 'center' }}>
                  <Space>
                    {progressMetrics.monthOverMonth >= 0 ? (
                      <ArrowUpOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
                    )}
                    <Text 
                      style={{ 
                        color: progressMetrics.monthOverMonth >= 0 ? '#52c41a' : '#ff4d4f',
                        fontWeight: 'bold'
                      }}
                    >
                      {Math.abs(progressMetrics.monthOverMonth).toFixed(1)}% from last month
                    </Text>
                  </Space>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
} 
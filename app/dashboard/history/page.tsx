"use client";

import React, { useState, useMemo } from 'react';
import { 
  Card, 
  Table, 
  Tag, 
  Button, 
  Space, 
  Typography, 
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Empty
} from 'antd';
import {
  PlayCircleOutlined,
  SearchOutlined,
  CalendarOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { getChats } from '@/utils/queries/chats/get-all-chats';
import { Chat } from '@/types';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function HistoryPage() {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['chats'],
    queryFn: () => getChats(),
  });

  // Sort sessions by newest first
  const sortedSessions = sessions?.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ) || [];

  // Filter sessions based on search and filters
  const filteredSessions = useMemo(() => {
    return sortedSessions.filter((session) => {
      // Search filter
      const matchesSearch = !searchText || 
        session.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        session.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        session.position?.toLowerCase().includes(searchText.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'completed' && session.completed_at) ||
        (statusFilter === 'in-progress' && !session.completed_at);

      // Type filter
      const matchesType = typeFilter === 'all' || session.type === typeFilter;

      // Date range filter
      const matchesDate = !dateRange || !dateRange[0] || !dateRange[1] ||
        (new Date(session.created_at) >= dateRange[0].toDate() &&
         new Date(session.created_at) <= dateRange[1].toDate());

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [sortedSessions, searchText, statusFilter, typeFilter, dateRange]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startDate: string, endDate?: string) => {
    if (!endDate) return 'In Progress';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.round(durationMs / (1000 * 60));
    
    return `${minutes} min`;
  };

  const getStatusTag = (chat: Chat) => {
    if (chat.completed_at) {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          Completed
        </Tag>
      );
    }
    return (
      <Tag color="processing" icon={<ClockCircleOutlined />}>
        In Progress
      </Tag>
    );
  };

  const getCandidateTypeTag = (type: string) => {
    const config = {
      'regular': { color: 'blue', label: 'Regular' },
      'ai-assisted': { color: 'orange', label: 'AI-Assisted' },
      'cheating': { color: 'red', label: 'Cheating' }
    };
    
    const { color, label } = config[type as keyof typeof config] || { color: 'default', label: type };
    return <Tag color={color}>{label}</Tag>;
  };

  const columns: ColumnsType<Chat> = [
    {
      title: 'Session Details',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Chat) => (
        <Space direction="vertical" size={4}>
          <Text strong>{title || 'Untitled Interview'}</Text>
          <Space>
            <UserOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary">{record.name || 'Unknown Candidate'}</Text>
          </Space>
          {record.position && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.position}
            </Text>
          )}
        </Space>
      ),
      width: 300,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => getCandidateTypeTag(type),
      filters: [
        { text: 'Regular', value: 'regular' },
        { text: 'AI-Assisted', value: 'ai-assisted' },
        { text: 'Cheating', value: 'cheating' },
      ],
      width: 120,
    },
    {
      title: 'Status',
      dataIndex: 'completed_at',
      key: 'status',
      render: (completedAt: string, record: Chat) => getStatusTag(record),
      filters: [
        { text: 'Completed', value: true },
        { text: 'In Progress', value: false },
      ],
      width: 130,
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_, record: Chat) => (
        <Text>{formatDuration(record.created_at, record.completed_at)}</Text>
      ),
      width: 100,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text>{formatDate(date)}</Text>
        </Space>
      ),
      sorter: (a: Chat, b: Chat) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      width: 180,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Chat) => (
        <Space>
          <Link href={`/interview/c/${record.id}`}>
            <Button 
              type="primary" 
              size="small" 
              icon={<EyeOutlined />}
            >
              View
            </Button>
          </Link>
        </Space>
      ),
      width: 100,
    },
  ];

  const paginationConfig: TablePaginationConfig = {
    pageSize: 10,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => 
      `${range[0]}-${range[1]} of ${total} sessions`,
  };

  // Calculate summary stats for filtered data
  const summaryStats = useMemo(() => {
    const total = filteredSessions.length;
    const completed = filteredSessions.filter(session => session.completed_at).length;
    const avgDuration = completed > 0 
      ? filteredSessions
          .filter(session => session.completed_at)
          .reduce((acc, session) => {
            const start = new Date(session.created_at);
            const end = new Date(session.completed_at);
            return acc + (end.getTime() - start.getTime());
          }, 0) / completed / (1000 * 60)
      : 0;

    return { total, completed, avgDuration: Math.round(avgDuration) };
  }, [filteredSessions]);

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Training Session History</Title>
        <Text type="secondary" style={{ fontSize: '16px' }}>
          Review and analyze your past simulation training sessions
        </Text>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Interviews"
              value={summaryStats.total}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Completed"
              value={summaryStats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Duration"
              value={summaryStats.avgDuration}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={8}>
            <Input
              placeholder="Search interviews..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="in-progress">In Progress</Select.Option>
            </Select>
          </Col>
          <Col xs={12} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Type"
              value={typeFilter}
              onChange={setTypeFilter}
            >
              <Select.Option value="all">All Types</Select.Option>
              <Select.Option value="regular">Regular</Select.Option>
              <Select.Option value="ai-assisted">AI-Assisted</Select.Option>
              <Select.Option value="cheating">Cheating</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Start Date', 'End Date']}
              value={dateRange}
              onChange={setDateRange}
            />
          </Col>
        </Row>
      </Card>

      {/* Interview Table */}
      <Card>
        {filteredSessions.length === 0 && !isLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                {sortedSessions.length === 0 
                  ? "No training sessions found. Start your first simulation to see history here."
                  : "No sessions match your current filters."
                }
              </span>
            }
          >
            {sortedSessions.length === 0 && (
              <Link href="/dashboard/trainings">
                <Button type="primary" icon={<PlayCircleOutlined />}>
                  Start First Simulation
                </Button>
              </Link>
            )}
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredSessions}
            rowKey="id"
            loading={isLoading}
            pagination={paginationConfig}
            scroll={{ x: 800 }}
          />
        )}
      </Card>
    </div>
  );
} 
"use client";

import React from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Button,
  Badge
} from 'antd';
import {
  PlayCircleOutlined,
  UserDeleteOutlined,
  TeamOutlined,
  CommentOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import Link from 'next/link';

const { Title, Paragraph } = Typography;

const trainingModules = [
  {
    id: 'interview-training',
    title: 'Interview Training',
    description: 'Master the art of conducting professional interviews with AI-powered candidates across various roles and scenarios.',
    icon: <PlayCircleOutlined />,
    status: 'available',
    href: '/training/interview/new',
    color: '#1890ff'
  },
  {
    id: 'offboarding',
    title: 'Employee Offboarding Training',
    description: 'Navigate sensitive employee departures with professionalism, ensuring smooth transitions and maintaining relationships.',
    icon: <UserDeleteOutlined />,
    status: 'available',
    href: '/training/offboarding/new',
    color: '#fa8c16'
  },
  {
    id: 'leadership-training',
    title: 'Leadership Development Training',
    description: 'Build essential leadership capabilities through strategic decision-making scenarios and team management challenges.',
    icon: <TeamOutlined />,
    status: 'coming-soon',
    href: '#',
    color: '#52c41a'
  },
  {
    id: 'decision-making',
    title: 'Decision Making Training',
    description: 'Practice responding to critical workplace situations with structured decision-making frameworks and expert guidance.',
    icon: <ExclamationCircleOutlined />,
    status: 'coming-soon',
    href: '#',
    color: '#eb2f96'
  },
  {
    id: 'group-discussion',
    title: 'Group Discussion Facilitation Training',
    description: 'Develop skills to lead productive team discussions, manage diverse perspectives, and drive consensus.',
    icon: <CommentOutlined />,
    status: 'coming-soon',
    href: '#',
    color: '#722ed1'
  },
];

export default function TrainingsPage() {
  return (
    <div>
      {/* Header Section */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={2}>Professional Training Modules</Title>
        <Paragraph type="secondary" style={{ fontSize: '16px' }}>
          Enhance your leadership and management capabilities through immersive, AI-powered training experiences designed for today&apos;s corporate environment.
        </Paragraph>
      </div>

      {/* Training Cards Grid */}
      <Row gutter={[24, 24]}>
        {trainingModules.map((module) => (
          <Col xs={24} sm={12} lg={8} key={module.id}>
            <Card 
              hoverable={module.status === 'available'}
              style={{ 
                height: '100%',
                cursor: module.status === 'available' ? 'pointer' : 'default',
                transition: 'all 0.3s ease',
                opacity: module.status === 'coming-soon' ? 0.8 : 1
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ 
                  fontSize: '48px', 
                  color: module.color,
                  marginBottom: '12px'
                }}>
                  {module.icon}
                </div>
                <Title level={4} style={{ margin: 0 }}>
                  {module.title}
                  {module.status === 'coming-soon' && (
                    <div style={{ marginTop: '8px' }}>
                      <Badge count="Soon" style={{ backgroundColor: '#fa8c16' }} />
                    </div>
                  )}
                </Title>
              </div>
              
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Paragraph type="secondary" style={{ 
                  margin: 0, 
                  lineHeight: 1.5,
                  minHeight: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {module.description}
                </Paragraph>
              </div>

              <div style={{ textAlign: 'center' }}>
                {module.status === 'available' ? (
                  <Link href={module.href}>
                    <Button 
                      type="primary" 
                      style={{ 
                        backgroundColor: module.color, 
                        borderColor: module.color 
                      }}
                    >
                      Start Training
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    disabled
                    style={{ 
                      backgroundColor: module.color, 
                      borderColor: module.color 
                    }}
                  >
                    Coming Soon
                  </Button>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Footer Information */}
      <Card 
        title="Advanced AI-Powered Learning" 
        style={{ marginTop: '32px' }}
        type="inner"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Title level={5}>Corporate-Ready Solutions</Title>
            <Paragraph type="secondary">
              Our training platform leverages cutting-edge artificial intelligence to create 
              realistic workplace scenarios. Each module provides personalized feedback and 
              comprehensive analytics to accelerate your professional development.
            </Paragraph>
          </Col>
          <Col xs={24} md={12}>
            <Title level={5}>Real-World Application</Title>
            <Paragraph type="secondary">
              Designed specifically for corporate environments, our modules focus on 
              real-world challenges that managers and leaders face daily. Build confidence 
              through practice in a risk-free environment.
            </Paragraph>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
"use client";

import React, { useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Button,
  Badge,
  App
} from 'antd';
import {
  BookOutlined,
  UserDeleteOutlined,
  TeamOutlined,
  ExclamationCircleOutlined,
  CommentOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Paragraph } = Typography;

const preparationModules = [
  {
    id: 'interview-prep',
    title: 'Interview Preparation',
    description: 'Learn essential interview techniques, common questions, and best practices for conducting professional interviews.',
    icon: <BookOutlined />,
    status: 'available',
    color: '#1890ff'
  },
  {
    id: 'offboarding-prep',
    title: 'Employee Offboarding Preparation',
    description: 'Understand the emotional and procedural aspects of employee departures before practicing scenarios.',
    icon: <UserDeleteOutlined />,
    status: 'available',
    color: '#fa8c16'
  },
  {
    id: 'leadership-prep',
    title: 'Leadership Development Preparation',
    description: 'Build foundational leadership knowledge including team dynamics, decision-making frameworks, and communication strategies.',
    icon: <TeamOutlined />,
    status: 'coming-soon',
    color: '#52c41a'
  },
  {
    id: 'decision-making-prep',
    title: 'Decision Making Preparation',
    description: 'Learn structured approaches to workplace decision-making, risk assessment, and problem-solving methodologies.',
    icon: <ExclamationCircleOutlined />,
    status: 'coming-soon',
    color: '#eb2f96'
  },
  {
    id: 'group-discussion-prep',
    title: 'Group Discussion Preparation',
    description: 'Master facilitation techniques, conflict resolution, and consensus-building strategies for team discussions.',
    icon: <CommentOutlined />,
    status: 'coming-soon',
    color: '#722ed1'
  },
];

export default function PreparationPage() {
  const router = useRouter();
  const [loadingSessions, setLoadingSessions] = useState<Record<string, boolean>>({});
  const { message } = App.useApp();

  const startPreparationSession = async (preparationType: string) => {
    setLoadingSessions(prev => ({ ...prev, [preparationType]: true }));
    
    try {
      const formData = new FormData();
      formData.append('type', preparationType);

      const response = await fetch('/api/preparation/start', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        router.push(`/preparation/${preparationType}/c/${data.chatId}`);
      } else {
        message.error('Failed to start preparation session');
      }
    } catch (error) {
      console.error('Error starting preparation session:', error);
      message.error('Failed to start preparation session');
    } finally {
      setLoadingSessions(prev => ({ ...prev, [preparationType]: false }));
    }
  };

  return (
    <div>
      {/* Header Section */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={2}>Preparation Resources</Title>
        <Paragraph type="secondary" style={{ fontSize: '16px' }}>
          Build your knowledge foundation before diving into interactive training sessions. Access comprehensive learning materials, tutorials, and resources to prepare for various workplace scenarios.
        </Paragraph>
      </div>

      {/* Preparation Cards Grid */}
      <Row gutter={[24, 24]}>
        {preparationModules.map((module) => (
          <Col xs={24} sm={12} lg={8} key={module.id}>
            <Card 
              hoverable={module.status === 'available'}
              style={{ 
                height: '100%',
                cursor: module.status === 'available' ? 'pointer' : 'default',
                transition: 'all 0.3s ease',
                opacity: module.status === 'coming-soon' ? 0.8 : 1
              }}
              onClick={() => module.status === 'available' && startPreparationSession(module.id)}
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
                  <Button 
                    loading={loadingSessions[module.id]}
                    style={{ 
                      backgroundColor: module.color, 
                      borderColor: module.color 
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startPreparationSession(module.id);
                    }}
                  >
                    Start Preparation
                  </Button>
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
        title="Knowledge Foundation" 
        style={{ marginTop: '32px' }}
        type="inner"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Title level={5}>Learn Before You Practice</Title>
            <Paragraph type="secondary">
              Preparation is key to effective training. Our comprehensive resource library provides 
              the foundational knowledge you need before engaging in interactive simulations. 
              Build confidence through structured learning paths.
            </Paragraph>
          </Col>
          <Col xs={24} md={12}>
            <Title level={5}>Structured Learning Approach</Title>
            <Paragraph type="secondary">
              Each preparation module is designed to complement our training simulations. 
              Start with theory and best practices, then apply your knowledge in realistic 
              workplace scenarios for maximum learning impact.
            </Paragraph>
          </Col>
        </Row>
      </Card>
    </div>
  );
} 
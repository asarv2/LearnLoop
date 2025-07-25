"use client";

import React, { useState } from 'react';
import { 
  Button, 
  Typography, 
  Row, 
  Col, 
  Card, 
  Space,
  Modal
} from 'antd';
import {
  PlayCircleOutlined,
  RobotOutlined,
  BarChartOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import AuthModal from './auth/AuthModal';

const { Title, Paragraph, Text } = Typography;

const features = [
  {
    icon: <RobotOutlined style={{ fontSize: '32px', color: '#1890ff' }} />,
    title: 'AI-Powered Simulations',
    description: 'Practice with advanced AI that adapts to your responses and provides realistic interview scenarios.'
  },
  {
    icon: <BarChartOutlined style={{ fontSize: '32px', color: '#52c41a' }} />,
    title: 'Detailed Analytics',
    description: 'Get comprehensive feedback on your performance with detailed scoring and improvement suggestions.'
  },
  {
    icon: <TeamOutlined style={{ fontSize: '32px', color: '#722ed1' }} />,
    title: 'Multiple Scenarios',
    description: 'Train across various interview types and difficulty levels to build comprehensive skills.'
  },
  {
    icon: <PlayCircleOutlined style={{ fontSize: '32px', color: '#fa8c16' }} />,
    title: 'Interactive Training',
    description: 'Engage in real-time conversations with voice and text support for immersive practice.'
  }
];

const benefits = [
  'Personalized AI feedback',
  'Performance tracking',
  'Multiple interview types',
  'Real-time scoring',
  'Professional development',
  'Skill improvement metrics'
];

export default function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const handleGetStarted = () => {
    setAuthMode('signup');
    setAuthModalOpen(true);
  };

  const handleSignIn = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ 
        background: 'white',
        borderBottom: '1px solid #f0f0f0',
        padding: '16px 0'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              L
            </div>
            <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
              LearnLoop
            </Title>
          </div>
          <Space>
            <Button type="text" onClick={handleSignIn}>
              Sign In
            </Button>
            <Button type="primary" onClick={handleGetStarted}>
              Get Started
            </Button>
          </Space>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        color: 'white',
        padding: '80px 0'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 24px',
          textAlign: 'center'
        }}>
          <Title level={1} style={{ 
            color: 'white', 
            fontSize: '48px', 
            marginBottom: '24px',
            fontWeight: 'bold'
          }}>
            Master Your Interview Skills with AI
          </Title>
          <Paragraph style={{ 
            fontSize: '20px', 
            color: 'rgba(255,255,255,0.9)', 
            marginBottom: '40px',
            maxWidth: '600px',
            margin: '0 auto 40px'
          }}>
            Practice interviews with advanced AI simulations, get real-time feedback, 
            and improve your performance with personalized training modules.
          </Paragraph>
          <Space size="large">
            <Button 
              type="primary" 
              size="large" 
              onClick={handleGetStarted}
              style={{ 
                background: 'white', 
                color: '#1890ff', 
                border: 'none',
                height: '48px',
                padding: '0 32px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
              icon={<ArrowRightOutlined />}
            >
              Start Training Now
            </Button>
            <Button 
              size="large" 
              onClick={handleSignIn}
              style={{ 
                background: 'transparent', 
                color: 'white', 
                border: '2px solid white',
                height: '48px',
                padding: '0 32px',
                fontSize: '16px'
              }}
            >
              Sign In
            </Button>
          </Space>
        </div>
      </div>

      {/* Features Section */}
      <div style={{ padding: '80px 0', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <Title level={2}>Why Choose LearnLoop?</Title>
            <Paragraph style={{ fontSize: '18px', color: '#8c8c8c', maxWidth: '600px', margin: '0 auto' }}>
              Our AI-powered platform provides comprehensive interview training 
              with personalized feedback and advanced analytics.
            </Paragraph>
          </div>
          
          <Row gutter={[32, 32]}>
            {features.map((feature, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                                 <Card 
                   style={{ 
                     height: '100%', 
                     textAlign: 'center',
                     border: '1px solid #f0f0f0',
                     borderRadius: '12px'
                   }}
                   styles={{ body: { padding: '32px 24px' } }}
                 >
                  <div style={{ marginBottom: '16px' }}>
                    {feature.icon}
                  </div>
                  <Title level={4} style={{ marginBottom: '12px' }}>
                    {feature.title}
                  </Title>
                  <Paragraph style={{ color: '#8c8c8c', margin: 0 }}>
                    {feature.description}
                  </Paragraph>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* Benefits Section */}
      <div style={{ padding: '80px 0', background: '#fafafa' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <Row gutter={[48, 48]} align="middle">
            <Col xs={24} lg={12}>
              <Title level={2}>Transform Your Interview Performance</Title>
              <Paragraph style={{ fontSize: '18px', color: '#8c8c8c', marginBottom: '32px' }}>
                LearnLoop provides everything you need to excel in interviews, 
                from AI-powered practice sessions to detailed performance analytics.
              </Paragraph>
              <div style={{ marginBottom: '32px' }}>
                {benefits.map((benefit, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginBottom: '12px' 
                  }}>
                    <CheckCircleOutlined style={{ 
                      color: '#52c41a', 
                      marginRight: '12px',
                      fontSize: '16px'
                    }} />
                    <Text style={{ fontSize: '16px' }}>{benefit}</Text>
                  </div>
                ))}
              </div>
              <Button 
                type="primary" 
                size="large"
                onClick={handleGetStarted}
                icon={<ArrowRightOutlined />}
                style={{ height: '48px', padding: '0 32px', fontSize: '16px' }}
              >
                Get Started Today
              </Button>
            </Col>
            <Col xs={24} lg={12}>
              <div style={{
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                borderRadius: '16px',
                padding: '40px',
                textAlign: 'center',
                color: 'white'
              }}>
                <RobotOutlined style={{ fontSize: '64px', marginBottom: '24px' }} />
                <Title level={3} style={{ color: 'white', marginBottom: '16px' }}>
                  AI-Powered Training
                </Title>
                <Paragraph style={{ color: 'rgba(255,255,255,0.9)', margin: 0 }}>
                  Experience the future of interview preparation with our 
                  advanced AI technology that adapts to your learning style.
                </Paragraph>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* CTA Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)',
        color: 'white',
        padding: '60px 0'
      }}>
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto', 
          padding: '0 24px',
          textAlign: 'center'
        }}>
          <Title level={2} style={{ color: 'white', marginBottom: '16px' }}>
            Ready to Ace Your Next Interview?
          </Title>
          <Paragraph style={{ 
            fontSize: '18px', 
            color: 'rgba(255,255,255,0.9)', 
            marginBottom: '32px'
          }}>
            Join thousands of professionals who have improved their interview skills with LearnLoop.
          </Paragraph>
          <Button 
            type="primary" 
            size="large"
            onClick={handleGetStarted}
            style={{ 
              background: 'white', 
              color: '#722ed1', 
              border: 'none',
              height: '48px',
              padding: '0 32px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
            icon={<ArrowRightOutlined />}
          >
            Start Your Free Training
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        background: '#001529', 
        color: 'white', 
        padding: '40px 0',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '8px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              L
            </div>
            <Text style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
              LearnLoop
            </Text>
          </div>
          <Paragraph style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            © 2024 LearnLoop. All rights reserved. Empowering professionals through AI-powered training.
          </Paragraph>
        </div>
      </div>

      <AuthModal 
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </div>
  );
} 
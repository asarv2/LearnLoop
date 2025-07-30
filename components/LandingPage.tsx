import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  Button, 
  Typography, 
  Row, 
  Col, 
  Card, 
  Space
} from 'antd';
import AuthModal from './auth/AuthModal';
import {
  RobotOutlined,
  BarChartOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  MessageOutlined,
  SoundOutlined,
  TrophyOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  CrownOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;



// Floating animation component
const FloatingCard = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const [offset, setOffset] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now() + delay;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      setOffset(Math.sin(elapsed * 0.001) * 10);
      requestAnimationFrame(animate);
    };
    animate();
  }, [delay]);
  
  return (
    <div style={{ transform: `translateY(${offset}px)`, transition: 'transform 0.1s ease-out' }}>
      {children}
    </div>
  );
};

const trainingTypes = [
  {
    icon: <MessageOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
    title: 'Interview Training',
    description: 'Master behavioral, technical, and leadership interviews with AI-powered practice sessions.'
  },
  {
    icon: <UserOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
    title: 'Off-boarding Conversations',
    description: 'Navigate sensitive departure discussions with confidence and professionalism.'
  },
  {
    icon: <CrownOutlined style={{ fontSize: '24px', color: '#722ed1' }} />,
    title: 'Leadership Development',
    description: 'Build essential leadership communication skills through realistic scenario training.'
  },
  {
    icon: <TeamOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />,
    title: '1-on-1 Meetings',
    description: 'Enhance manager-employee conversations and performance discussions.'
  },
  {
    icon: <UsergroupAddOutlined style={{ fontSize: '24px', color: '#eb2f96' }} />,
    title: 'Group Facilitation',
    description: 'Lead effective team meetings, workshops, and collaborative sessions.'
  },
  {
    icon: <SoundOutlined style={{ fontSize: '24px', color: '#13c2c2' }} />,
    title: 'Voice & Text Training',
    description: 'Practice in your preferred format with advanced speech recognition technology.'
  }
];

const processSteps = [
  {
    number: '01',
    title: 'Learn',
    description: 'Study exemplary conversations and understand what effective communication looks like in your specific scenario.',
    icon: <BarChartOutlined style={{ fontSize: '32px', color: '#1890ff' }} />
  },
  {
    number: '02',
    title: 'Practice',
    description: 'Engage with custom AI models tailored to your training needs through text or voice conversations.',
    icon: <RobotOutlined style={{ fontSize: '32px', color: '#52c41a' }} />
  },
  {
    number: '03',
    title: 'Reflect',
    description: 'Complete personalized assessments to evaluate your conversation experience and learning outcomes.',
    icon: <MessageOutlined style={{ fontSize: '32px', color: '#722ed1' }} />
  },
  {
    number: '04',
    title: 'Improve',
    description: 'Receive detailed performance scores and actionable feedback to continuously enhance your skills.',
    icon: <TrophyOutlined style={{ fontSize: '32px', color: '#fa8c16' }} />
  }
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
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      {/* Header */}
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(240, 240, 240, 0.8)',
        padding: '16px 0',
        position: 'sticky',
        top: 0,
        zIndex: 1000
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
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
            }}>
              L
            </div>
            <Title level={3} style={{ margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LearnLoop
            </Title>
          </div>
          <Space>
            <Button type="text" onClick={handleSignIn} style={{ fontWeight: 500 }}>
              Sign In
            </Button>
            <Button 
              type="primary" 
              onClick={handleGetStarted}
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 500,
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
              }}
            >
              Get Started
            </Button>
          </Space>
        </div>
      </div>

      {/* Hero Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '100px 0',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background elements */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          animation: 'float 6s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute',
          top: '60%',
          right: '15%',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          animation: 'float 4s ease-in-out infinite reverse'
        }} />
        
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 24px',
          position: 'relative',
          zIndex: 2
        }}>
          <Row gutter={[48, 48]} align="middle">
            <Col xs={24} lg={12}>
              <Title level={1} style={{ 
                color: 'white', 
                fontSize: '52px', 
                marginBottom: '24px',
                fontWeight: 700,
                lineHeight: 1.2
              }}>
                Practice Professional Communication Through AI-Simulated Training
              </Title>
              <Paragraph style={{ 
                fontSize: '20px', 
                color: 'rgba(255,255,255,0.9)', 
                marginBottom: '40px',
                lineHeight: 1.6
              }}>
                Master interviews, leadership conversations, team facilitation, and critical workplace discussions with personalized AI coaching and real-time feedback.
              </Paragraph>
              <Space size="large" style={{ marginBottom: '40px' }}>
                <Button 
                  type="primary" 
                  size="large" 
                  onClick={handleGetStarted}
                  style={{ 
                    background: 'white', 
                    color: '#667eea', 
                    border: 'none',
                    height: '56px',
                    padding: '0 32px',
                    fontSize: '16px',
                    fontWeight: 600,
                    borderRadius: '12px',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                  }}
                  icon={<ArrowRightOutlined />}
                >
                  Start Training Today
                </Button>
                <Button 
                  size="large" 
                  onClick={() => window.open('https://calendly.com/siladiea2005/learnloop-demo', '_blank')}
                  style={{ 
                    background: 'transparent', 
                    color: 'white', 
                    border: '2px solid rgba(255,255,255,0.8)',
                    height: '56px',
                    padding: '0 32px',
                    fontSize: '16px',
                    borderRadius: '12px',
                    fontWeight: 500
                  }}
                >
                  Schedule a Demo
                </Button>
              </Space>
              

            </Col>
            
            <Col xs={24} lg={12}>
              <FloatingCard delay={0}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '20px',
                  padding: '40px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '20px',
                    textAlign: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                    overflow: 'hidden'
                  }}>
                    <Image 
                      src="/LP_Image.png"
                      alt="AI Training Assistant - Professional interview training with AI"
                      width={400}
                      height={300}
                      style={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: '12px',
                        maxWidth: '400px',
                        objectFit: 'cover'
                      }}
                    />
                  </div>
                </div>
              </FloatingCard>
            </Col>
          </Row>
        </div>
        
        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
        `}</style>
      </div>

      {/* Training Types Section */}
      <div style={{ padding: '100px 0', background: '#fafbfc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <Title level={2} style={{ fontSize: '42px', marginBottom: '20px', color: '#1a1a1a' }}>
              Comprehensive Training Solutions
            </Title>
            <Paragraph style={{ 
              fontSize: '18px', 
              color: '#666', 
              maxWidth: '700px', 
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              From high-stakes interviews to everyday workplace conversations, our platform covers every scenario your team needs to master.
            </Paragraph>
          </div>
          
          <Row gutter={[32, 32]}>
            {trainingTypes.map((type, index) => (
              <Col xs={24} sm={12} lg={8} key={index}>
                <FloatingCard delay={index * 200}>
                  <Card 
                    style={{ 
                      height: '100%', 
                      borderRadius: '16px',
                      border: '1px solid #f0f0f0',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    styles={{ body: { padding: '32px 24px' } }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-8px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0px)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                    }}
                  >
                    <div style={{ 
                      width: '60px',
                      height: '60px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #f6f9fc 0%, #eef2f7 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '20px'
                    }}>
                      {type.icon}
                    </div>
                    <Title level={4} style={{ marginBottom: '12px', color: '#1a1a1a' }}>
                      {type.title}
                    </Title>
                    <Paragraph style={{ color: '#666', margin: 0, lineHeight: 1.6 }}>
                      {type.description}
                    </Paragraph>
                  </Card>
                </FloatingCard>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* Process Section */}
      <div style={{ padding: '100px 0', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <Title level={2} style={{ fontSize: '42px', marginBottom: '20px', color: '#1a1a1a' }}>
              How It Works
            </Title>
            <Paragraph style={{ 
              fontSize: '18px', 
              color: '#666', 
              maxWidth: '600px', 
              margin: '0 auto',
              lineHeight: 1.6
            }}>
              Our proven four-step methodology ensures measurable improvement in professional communication skills.
            </Paragraph>
          </div>
          
          <Row gutter={[48, 48]}>
            {processSteps.map((step, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <div style={{ textAlign: 'center', position: 'relative' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: 'white',
                    boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)'
                  }}>
                    {step.icon}
                  </div>
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '20px',
                    background: '#ff6b6b',
                    color: 'white',
                    borderRadius: '12px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {step.number}
                  </div>
                  <Title level={4} style={{ marginBottom: '16px', color: '#1a1a1a' }}>
                    {step.title}
                  </Title>
                  <Paragraph style={{ color: '#666', margin: 0, lineHeight: 1.6 }}>
                    {step.description}
                  </Paragraph>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* Features Showcase */}
      <div style={{ padding: '100px 0', background: 'linear-gradient(135deg, #f6f9fc 0%, #eef2f7 100%)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <Row gutter={[64, 64]} align="middle">
            <Col xs={24} lg={12}>
              <Title level={2} style={{ fontSize: '42px', marginBottom: '24px', color: '#1a1a1a' }}>
                Advanced Training Technology
              </Title>
              <Paragraph style={{ 
                fontSize: '18px', 
                color: '#666', 
                marginBottom: '32px',
                lineHeight: 1.6
              }}>
                Leverage cutting-edge AI technology to create realistic training scenarios that adapt to your specific industry, role, and skill level.
              </Paragraph>
              
              <div style={{ marginBottom: '40px' }}>
                <Row gutter={[24, 24]}>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <CheckCircleOutlined style={{ 
                        color: '#52c41a', 
                        marginRight: '12px',
                        fontSize: '18px'
                      }} />
                      <Text style={{ fontSize: '16px', fontWeight: 500 }}>Real-time voice analysis</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <CheckCircleOutlined style={{ 
                        color: '#52c41a', 
                        marginRight: '12px',
                        fontSize: '18px'
                      }} />
                      <Text style={{ fontSize: '16px', fontWeight: 500 }}>Custom AI personalities</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <CheckCircleOutlined style={{ 
                        color: '#52c41a', 
                        marginRight: '12px',
                        fontSize: '18px'
                      }} />
                      <Text style={{ fontSize: '16px', fontWeight: 500 }}>Performance analytics</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <CheckCircleOutlined style={{ 
                        color: '#52c41a', 
                        marginRight: '12px',
                        fontSize: '18px'
                      }} />
                      <Text style={{ fontSize: '16px', fontWeight: 500 }}>Progress tracking</Text>
                    </div>
                  </Col>
                </Row>
              </div>
              
            </Col>
            
            <Col xs={24} lg={12}>
              <FloatingCard delay={500}>
                <div style={{
                  background: 'white',
                  borderRadius: '20px',
                  padding: '40px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(255,255,255,0.8)'
                }}>
                  <Row gutter={[24, 24]}>
                    <Col span={24}>
                      <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '12px',
                        padding: '20px',
                        color: 'white',
                        textAlign: 'center'
                      }}>
                        <MessageOutlined style={{ fontSize: '32px', marginBottom: '12px' }} />
                        <Text style={{ color: 'white', fontSize: '16px', fontWeight: 500 }}>
                          Voice & Text Training
                        </Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{
                        background: '#f6f9fc',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center',
                        height: '100px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}>
                        <BarChartOutlined style={{ fontSize: '24px', color: '#667eea', marginBottom: '8px' }} />
                        <Text style={{ fontSize: '14px', fontWeight: 500 }}>Analytics</Text>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{
                        background: '#f6f9fc',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center',
                        height: '100px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}>
                        <TrophyOutlined style={{ fontSize: '24px', color: '#667eea', marginBottom: '8px' }} />
                        <Text style={{ fontSize: '14px', fontWeight: 500 }}>Feedback</Text>
                      </div>
                    </Col>
                  </Row>
                </div>
              </FloatingCard>
            </Col>
          </Row>
        </div>
      </div>

      {/* CTA Section */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%)',
        color: 'white',
        padding: '80px 0',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '5%',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(102, 126, 234, 0.2)',
          animation: 'float 8s ease-in-out infinite'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '30%',
          right: '10%',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'rgba(118, 75, 162, 0.2)',
          animation: 'float 6s ease-in-out infinite reverse'
        }} />
        
        <div style={{ 
          maxWidth: '800px', 
          margin: '0 auto', 
          padding: '0 24px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 2
        }}>
          <Title level={2} style={{ 
            color: 'white', 
            marginBottom: '20px',
            fontSize: '42px',
            fontWeight: 700
          }}>
            Ready to Transform Your Team&apos;s Communication?
          </Title>
          <Paragraph style={{ 
            fontSize: '20px', 
            color: 'rgba(255,255,255,0.8)', 
            marginBottom: '40px',
            lineHeight: 1.6
          }}>
            Join forward-thinking organizations that are investing in their people through AI-powered professional development.
          </Paragraph>
          <Space size="large">
            <Button 
              type="primary" 
              size="large"
              onClick={handleGetStarted}
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                border: 'none',
                height: '56px',
                padding: '0 40px',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '12px',
                boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)'
              }}
              icon={<ArrowRightOutlined />}
            >
              Begin Training Today
            </Button>
            <Button 
              size="large"
              onClick={() => window.open('https://calendly.com/siladiea2005/learnloop-demo', '_blank')}
              style={{ 
                background: 'transparent', 
                color: 'white', 
                border: '2px solid rgba(255,255,255,0.3)',
                height: '56px',
                padding: '0 32px',
                fontSize: '16px',
                borderRadius: '12px',
                fontWeight: 500
              }}
            >
              Schedule Demo
            </Button>
          </Space>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        background: '#0a0a0a', 
        color: 'white', 
        padding: '60px 0 40px',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <Row gutter={[48, 32]}>
            <Col xs={24} md={8}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                <Title level={4} style={{ color: 'white', margin: 0 }}>
                  LearnLoop
                </Title>
              </div>
              <Paragraph style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                Empowering professionals worldwide through AI-powered communication training and development.
              </Paragraph>
            </Col>
            <Col xs={24} md={16}>
              <Row gutter={[32, 24]}>
                <Col xs={12} sm={8}>
                  <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>Platform</Title>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Features</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Pricing</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Security</Text>
                  </div>
                </Col>
                <Col xs={12} sm={8}>
                  <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>Training</Title>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Interviews</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Leadership</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Team Skills</Text>
                  </div>
                </Col>
                <Col xs={12} sm={8}>
                  <Title level={5} style={{ color: 'white', marginBottom: '16px' }}>Support</Title>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Help Center</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Contact</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Resources</Text>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
          <div style={{ 
            borderTop: '1px solid rgba(255,255,255,0.1)', 
            paddingTop: '30px', 
            marginTop: '40px',
            textAlign: 'center'
          }}>
            <Paragraph style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              © 2024 LearnLoop. All rights reserved. Transforming professional communication through intelligent training.
            </Paragraph>
          </div>
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
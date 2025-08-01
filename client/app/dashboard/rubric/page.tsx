"use client";

import React, { useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Table,
  Space,
  Button,
  Alert,
  Badge
} from 'antd';
import {
  FileTextOutlined,
  MessageOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CommentOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

interface RubricCriteria {
  category: string;
  description: string;
  score1: string;
  score2: string;
  score3: string;
  score4: string;
  score5: string;
}

const interviewRubricData: RubricCriteria[] = [
  {
    category: "Question Quality & Depth",
    description: "Sophistication and preparation of questions",
    score1: "Generic, surface-level questions with no preparation",
    score2: "Basic questions with minimal thought",
    score3: "Standard interview questions, adequate preparation",
    score4: "Well-crafted questions that probe deeper into topics",
    score5: "Sophisticated, insightful questions that reveal true capabilities"
  },
  {
    category: "Follow-up & Probing Skills",
    description: "Ability to dig deeper and uncover insights",
    score1: "No follow-up questions, accepts vague answers",
    score2: "Minimal follow-up, misses opportunities to dig deeper",
    score3: "Some follow-up questions, basic probing",
    score4: "Consistent follow-up, good probing when needed",
    score5: "Expert follow-up skills, uncovers detailed insights"
  },
  {
    category: "Assessment Thoughtfulness",
    description: "Quality of evaluation and reflection",
    score1: "Rushed, superficial assessment responses",
    score2: "Basic assessment with minimal reflection",
    score3: "Adequate assessment, some consideration of key points",
    score4: "Thoughtful assessment with good analysis",
    score5: "Deep, insightful assessment demonstrating strong evaluation skills"
  },
  {
    category: "Interview Conduct & Flow",
    description: "Structure, pacing, and transitions",
    score1: "Disorganized, poor pacing, awkward transitions",
    score2: "Some structure issues, uneven flow",
    score3: "Decent structure and pacing, adequate flow",
    score4: "Well-structured interview with smooth transitions",
    score5: "Masterful interview flow, perfect pacing and structure"
  },
  {
    category: "Communication & Rapport",
    description: "Professional communication and candidate comfort",
    score1: "Poor communication, no rapport building",
    score2: "Basic communication, minimal rapport",
    score3: "Clear communication, some rapport established",
    score4: "Strong communication skills, good rapport",
    score5: "Exceptional communication, excellent candidate comfort"
  },
  {
    category: "Professional Judgment",
    description: "Decision-making and evaluation skills",
    score1: "Poor decision-making, unrealistic expectations",
    score2: "Some judgment issues, inconsistent evaluation",
    score3: "Reasonable judgment, fair evaluation",
    score4: "Sound professional judgment, balanced evaluation",
    score5: "Outstanding judgment, highly professional evaluation"
  }
];

const offboardingRubricData: RubricCriteria[] = [
  {
    category: "Empathy & Emotional Intelligence",
    description: "Sensitivity to employee emotions and demonstration of empathy during offboarding.",
    score1: "Insensitive, dismissive of employee emotions",
    score2: "Limited empathy, awkward emotional handling",
    score3: "Some empathy shown, basic emotional awareness",
    score4: "Strong empathy, good emotional support",
    score5: "Outstanding emotional intelligence, exceptional empathy"
  },
  {
    category: "Communication Clarity & Professionalism",
    description: "Clarity, professionalism, and respectfulness in communication.",
    score1: "Unclear, unprofessional communication",
    score2: "Some clarity issues, inconsistent professionalism",
    score3: "Clear enough communication, adequate professionalism",
    score4: "Clear, professional communication throughout",
    score5: "Exceptional clarity and professionalism under pressure"
  },
  {
    category: "Clarity of Next Steps",
    description: "How clearly the manager communicates what happens after offboarding and what the employee should expect.",
    score1: "No explanation of what happens after offboarding, leaves employee confused",
    score2: "Minimal explanation, vague or incomplete next steps",
    score3: "Basic explanation of next steps, some clarity",
    score4: "Clear explanation of what happens next, employee knows what to expect",
    score5: "Exceptionally clear, employee feels fully informed and supported about next steps"
  },
  {
    category: "Transition Planning & Logistics",
    description: "Effectiveness in planning the employee's transition and handling logistics.",
    score1: "No planning discussed, chaotic approach",
    score2: "Minimal planning, poor logistics handling",
    score3: "Some planning discussed, basic logistics covered",
    score4: "Good transition planning, well-organized logistics",
    score5: "Comprehensive planning, seamless logistics coordination"
  },
  {
    category: "Conflict Resolution & Difficult Conversations",
    description: "Ability to handle conflicts and sensitive topics professionally.",
    score1: "Escalated conflicts, avoided difficult topics",
    score2: "Some conflict handling, minimal difficult topic management",
    score3: "Handled conflicts adequately, addressed most difficult topics",
    score4: "Strong conflict resolution, good handling of sensitive topics",
    score5: "Masterful conflict resolution, exceptional handling of all difficult conversations"
  },
  {
    category: "Assessment Thoughtfulness & Reflection",
    description: "Depth of self-reflection and thoughtfulness in assessment responses.",
    score1: "Superficial assessment, no self-reflection",
    score2: "Basic assessment, minimal reflection",
    score3: "Adequate assessment, some self-awareness",
    score4: "Thoughtful assessment, good self-reflection",
    score5: "Deep, insightful assessment with excellent self-awareness"
  }
];

const rubricModules = [
  {
    id: 'interview-training',
    title: 'Interview Rubric',
    description: 'Comprehensive evaluation framework for interviewer performance including question quality, follow-up skills, and professional judgment.',
    icon: <FileTextOutlined />, 
    status: 'available',
    color: '#1890ff'
  },
  {
    id: 'offboarding',
    title: 'Employee Offboarding Rubric',
    description: 'Evaluation framework for conducting professional employee departures and exit processes.',
    icon: <MessageOutlined />, 
    status: 'available',
    color: '#fa8c16'
  },
  {
    id: 'leadership-training',
    title: 'Leadership Development Rubric',
    description: 'Assessment criteria for leadership skills including team management, strategic thinking, and motivational communication.',
    icon: <TeamOutlined />,
    status: 'coming-soon',
    color: '#52c41a'
  },
  {
    id: 'decision-making',
    title: 'Decision Making Rubric',
    description: 'Evaluation framework for critical workplace situations and decision-making scenarios.',
    icon: <ExclamationCircleOutlined />,
    status: 'coming-soon',
    color: '#eb2f96'
  },
  {
    id: 'group-discussion',
    title: 'Group Discussion Facilitation Rubric',
    description: 'Assessment criteria for leading productive team discussions and managing group dynamics.',
    icon: <CommentOutlined />,
    status: 'coming-soon',
    color: '#722ed1'
  }
];

export default function RubricPage() {
  const [selectedRubric, setSelectedRubric] = useState<string | null>(null);

  const rubricColumns: ColumnsType<RubricCriteria> = [
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 200,
      fixed: 'left',
      render: (text: string, record: RubricCriteria) => (
        <Space direction="vertical" size={4}>
          <Text strong style={{ color: '#1890ff' }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '1 - Poor',
      dataIndex: 'score1',
      key: 'score1',
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: '13px', lineHeight: '1.4' }}>{text}</Text>
      ),
    },
    {
      title: '2 - Needs Improvement',
      dataIndex: 'score2',
      key: 'score2',
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: '13px', lineHeight: '1.4' }}>{text}</Text>
      ),
    },
    {
      title: '3 - Satisfactory',
      dataIndex: 'score3',
      key: 'score3',
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: '13px', lineHeight: '1.4' }}>{text}</Text>
      ),
    },
    {
      title: '4 - Good',
      dataIndex: 'score4',
      key: 'score4',
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: '13px', lineHeight: '1.4' }}>{text}</Text>
      ),
    },
    {
      title: '5 - Excellent',
      dataIndex: 'score5',
      key: 'score5',
      width: 180,
      render: (text: string) => (
        <Text style={{ fontSize: '13px', lineHeight: '1.4' }}>{text}</Text>
      ),
    },
  ];

  if (selectedRubric === 'interview-training' || selectedRubric === 'offboarding') {
    const isOffboarding = selectedRubric === 'offboarding';
    return (
      <div>
        <Space align="center" style={{ marginBottom: '24px' }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => setSelectedRubric(null)}
          >
            Back to Rubrics
          </Button>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '12px',
            background: isOffboarding
              ? 'linear-gradient(135deg, #fa8c16 0%, #fa8c1699 100%)'
              : 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isOffboarding ? <MessageOutlined style={{ fontSize: '24px', color: 'white' }} /> : <FileTextOutlined style={{ fontSize: '24px', color: 'white' }} />}
          </div>
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              {isOffboarding ? 'Employee Offboarding Rubric' : 'Interview Training Rubric'}
            </Title>
            <Text type="secondary">{isOffboarding ? 'Evaluation framework for employee offboarding conversations' : 'Comprehensive evaluation framework'}</Text>
          </Space>
        </Space>

        <Alert
          message="Scoring Formula"
          description="Overall Score = (Sum of all category scores ÷ 6) × 20 = Score out of 100"
          type="info"
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: '24px' }}
        />

        <Card>
          <Table
            columns={rubricColumns}
            dataSource={isOffboarding ? offboardingRubricData : interviewRubricData}
            rowKey="category"
            pagination={false}
            scroll={{ x: 1200 }}
            size="middle"
          />
        </Card>

        <Card style={{ marginTop: '24px' }} type="inner">
          <Title level={4}>How to Use This Rubric</Title>
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Paragraph>
                <Text strong>During the {isOffboarding ? 'Offboarding Conversation' : 'Interview'}:</Text>
                <br />
                • Take notes on each category as you observe the {isOffboarding ? 'manager\'s' : 'interviewer\'s'} performance
                <br />
                • Focus on specific examples and behaviors
                <br />
                • Consider the context and complexity of the {isOffboarding ? 'offboarding' : 'interview'}
              </Paragraph>
            </Col>
            <Col xs={24} md={12}>
              <Paragraph>
                <Text strong>After the {isOffboarding ? 'Offboarding Conversation' : 'Interview'}:</Text>
                <br />
                • Score each category on the 1-5 scale
                <br />
                • Calculate the overall score using the formula above
                <br />
                • Provide specific feedback with examples from each category
              </Paragraph>
            </Col>
          </Row>
        </Card>
      </div>
    );
  }

  if (selectedRubric && selectedRubric !== 'interview-training' && selectedRubric !== 'offboarding') {
    const selectedModule = rubricModules.find(m => m.id === selectedRubric);
    
    return (
      <div>
        <Space align="center" style={{ marginBottom: '24px' }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => setSelectedRubric(null)}
          >
            Back to Rubrics
          </Button>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${selectedModule?.color} 0%, ${selectedModule?.color}99 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '24px', color: 'white' }}>
              {selectedModule?.icon}
            </div>
          </div>
          <Space direction="vertical" size={4}>
            <Title level={3} style={{ margin: 0 }}>
              {selectedModule?.title}
            </Title>
            <Badge count="Coming Soon" style={{ backgroundColor: '#fa8c16' }} />
          </Space>
        </Space>

        <Card style={{ textAlign: 'center', padding: '80px 40px' }}>
          <Space direction="vertical" size="large">
            <Text style={{ fontSize: '48px' }}>🚧</Text>
            <Title level={4}>Work in Progress</Title>
            <Paragraph type="secondary" style={{ maxWidth: '500px', margin: '0 auto' }}>
              This rubric is currently being developed and will be available soon with 
              comprehensive evaluation criteria tailored for {selectedModule?.title.toLowerCase().replace(' rubric', '')} scenarios.
            </Paragraph>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <Title level={2}>Evaluation Frameworks</Title>
        <Paragraph type="secondary" style={{ fontSize: '16px' }}>
          Comprehensive evaluation criteria for assessing performance across all simulation types and training modules.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {rubricModules.map((module) => (
          <Col xs={24} sm={12} lg={8} key={module.id}>
            <Card 
              hoverable={module.status === 'available'}
              onClick={() => setSelectedRubric(module.id)}
              style={{ 
                height: '100%',
                cursor: 'pointer',
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
                <Button 
                  type={module.status === 'available' ? 'primary' : 'default'}
                  disabled={module.status === 'coming-soon'}
                  style={{ 
                    backgroundColor: module.status === 'available' ? module.color : undefined, 
                    borderColor: module.status === 'available' ? module.color : undefined
                  }}
                >
                  {module.status === 'available' ? 'View Rubric Details' : 'Coming Soon'}
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card 
        title="Rubric Information" 
        style={{ marginTop: '32px' }}
        type="inner"
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Title level={5}>Purpose</Title>
            <Paragraph type="secondary">
              These rubrics provide standardized evaluation criteria to ensure consistent 
              and fair assessment of performance across different training scenarios. 
              Each rubric is designed to measure specific competencies relevant to the training module.
            </Paragraph>
          </Col>
          <Col xs={24} md={12}>
            <Title level={5}>Usage Guidelines</Title>
            <Paragraph type="secondary">
              Use these rubrics during or immediately after training sessions to evaluate 
              performance objectively. The scoring system helps identify strengths and areas 
              for improvement, providing targeted feedback for skill development.
            </Paragraph>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
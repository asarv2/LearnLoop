"use client";

import React, { useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Form,
  Select,
  Switch,
  Button,
  Space,
  Divider,
  Input,
  Radio,
  Slider,
  Alert,
  message
} from 'antd';
import {
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  SecurityScanOutlined,
  ExportOutlined,
  DeleteOutlined,
  SaveOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function SettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('Settings saved successfully');
      console.log('Settings saved:', values);
    } catch (error) {
      message.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = () => {
    message.info('Data export initiated. You will receive an email when ready.');
  };

  const handleDeleteAccount = () => {
    message.warning('Account deletion requires email confirmation. Check your inbox.');
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <Title level={2}>Settings</Title>
        <Paragraph type="secondary" style={{ fontSize: '16px' }}>
          Customize your simulation training experience and manage your account preferences.
        </Paragraph>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          defaultInterviewType: 'regular',
          defaultDuration: 30,
          difficultyLevel: 'intermediate',
          autoSave: true,
          emailNotifications: true,
          weeklyReports: false,
          soundEffects: true,
          theme: 'light',
          language: 'en',
          timezone: 'America/New_York'
        }}
      >
        <Row gutter={[24, 24]}>
          {/* Interview Preferences */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <SettingOutlined />
                  <span>Interview Preferences</span>
                </Space>
              }
            >
              <Form.Item
                label="Default Simulation Type"
                name="defaultSimulationType"
                help="The default simulation type for new training sessions"
              >
                <Select>
                  <Select.Option value="interview">Interview Training</Select.Option>
                  <Select.Option value="offboarding">Employee Offboarding</Select.Option>
                  <Select.Option value="leadership">Leadership Development</Select.Option>
                  <Select.Option value="decision-making">Decision Making Training</Select.Option>
                  <Select.Option value="group-discussion">Group Discussion</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Default Duration (minutes)"
                name="defaultDuration"
                help="Standard session length for new training simulations"
              >
                <Slider
                  min={15}
                  max={90}
                  step={15}
                  marks={{
                    15: '15m',
                    30: '30m',
                    45: '45m',
                    60: '60m',
                    90: '90m'
                  }}
                />
              </Form.Item>

              <Form.Item
                label="Difficulty Level"
                name="difficultyLevel"
                help="Default complexity level for training scenarios"
              >
                <Radio.Group>
                  <Radio.Button value="beginner">Beginner</Radio.Button>
                  <Radio.Button value="intermediate">Intermediate</Radio.Button>
                  <Radio.Button value="advanced">Advanced</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                label="Auto-save Progress"
                name="autoSave"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Card>
          </Col>

          {/* Notification Settings */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <BellOutlined />
                  <span>Notifications</span>
                </Space>
              }
            >
              <Form.Item
                label="Email Notifications"
                name="emailNotifications"
                valuePropName="checked"
                help="Receive updates about new features and tips"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="Weekly Progress Reports"
                name="weeklyReports"
                valuePropName="checked"
                help="Get weekly summaries of your training progress"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="Sound Effects"
                name="soundEffects"
                valuePropName="checked"
                help="Enable audio feedback during training"
              >
                <Switch />
              </Form.Item>

              <Divider />

              <Form.Item
                label="Email Address"
                help="Update your contact email for notifications"
              >
                <Input 
                  placeholder="your-email@company.com" 
                  disabled
                  value="admin@company.com"
                />
                <Button type="link" size="small" style={{ padding: 0, marginTop: '4px' }}>
                  Change Email
                </Button>
              </Form.Item>
            </Card>
          </Col>

          {/* System Preferences */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <UserOutlined />
                  <span>System Preferences</span>
                </Space>
              }
            >
              <Form.Item
                label="Theme"
                name="theme"
                help="Choose your preferred interface theme"
              >
                <Select>
                  <Select.Option value="light">Light</Select.Option>
                  <Select.Option value="dark">Dark</Select.Option>
                  <Select.Option value="auto">Auto (System)</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Language"
                name="language"
                help="Interface language preference"
              >
                <Select>
                  <Select.Option value="en">English</Select.Option>
                  <Select.Option value="es">Spanish</Select.Option>
                  <Select.Option value="fr">French</Select.Option>
                  <Select.Option value="de">German</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Timezone"
                name="timezone"
                help="Used for scheduling and reports"
              >
                <Select showSearch>
                  <Select.Option value="America/New_York">Eastern Time (ET)</Select.Option>
                  <Select.Option value="America/Chicago">Central Time (CT)</Select.Option>
                  <Select.Option value="America/Denver">Mountain Time (MT)</Select.Option>
                  <Select.Option value="America/Los_Angeles">Pacific Time (PT)</Select.Option>
                  <Select.Option value="Europe/London">London (GMT)</Select.Option>
                  <Select.Option value="Europe/Paris">Paris (CET)</Select.Option>
                </Select>
              </Form.Item>
            </Card>
          </Col>

          {/* Security & Privacy */}
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <SecurityScanOutlined />
                  <span>Security & Privacy</span>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text strong>Password</Text>
                  <br />
                  <Text type="secondary">Last changed 3 months ago</Text>
                  <br />
                  <Button type="link" size="small" style={{ padding: 0, marginTop: '4px' }}>
                    Change Password
                  </Button>
                </div>

                <Divider />

                <div>
                  <Text strong>Two-Factor Authentication</Text>
                  <br />
                  <Text type="secondary">Add an extra layer of security</Text>
                  <br />
                  <Button type="link" size="small" style={{ padding: 0, marginTop: '4px' }}>
                    Enable 2FA
                  </Button>
                </div>

                <Divider />

                <div>
                  <Text strong>Session Management</Text>
                  <br />
                  <Text type="secondary">Manage active sessions and devices</Text>
                  <br />
                  <Button type="link" size="small" style={{ padding: 0, marginTop: '4px' }}>
                    View Active Sessions
                  </Button>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Data Management */}
        <Card 
          title="Data Management" 
          style={{ marginTop: '24px' }}
          type="inner"
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} md={12}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Title level={5}>Export Your Data</Title>
                  <Paragraph type="secondary">
                    Download a copy of your interview history, progress reports, and settings.
                  </Paragraph>
                  <Button 
                    icon={<ExportOutlined />}
                    onClick={handleExportData}
                  >
                    Export Data
                  </Button>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Title level={5}>Data Retention</Title>
                  <Paragraph type="secondary">
                    Your interview data is retained for 2 years to track progress. 
                    You can request deletion at any time.
                  </Paragraph>
                  <Button type="link" size="small" style={{ padding: 0 }}>
                    View Privacy Policy
                  </Button>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Danger Zone */}
        <Card 
          title="Account Actions" 
          style={{ marginTop: '24px' }}
        >
          <Alert
            message="Danger Zone"
            description="These actions cannot be undone. Please proceed with caution."
            type="warning"
            style={{ marginBottom: '16px' }}
          />
          
          <Space>
            <Button 
              danger 
              icon={<DeleteOutlined />}
              onClick={handleDeleteAccount}
            >
              Delete Account
            </Button>
            <Text type="secondary">
              This will permanently delete your account and all associated data.
            </Text>
          </Space>
        </Card>

        {/* Save Button */}
        <Card style={{ marginTop: '24px', textAlign: 'center' }}>
          <Space size="middle">
            <Button 
              type="primary" 
              size="large"
              icon={<SaveOutlined />}
              htmlType="submit"
              loading={loading}
            >
              Save Settings
            </Button>
            <Button size="large" onClick={() => form.resetFields()}>
              Reset to Default
            </Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
} 
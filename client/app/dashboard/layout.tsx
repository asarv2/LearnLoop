"use client";

import React, { useState } from 'react';
import { Layout, Menu, theme, Avatar, Dropdown, Space, Typography, Button } from 'antd';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  BulbOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BookOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { MenuProps } from 'antd';
import { useAuth } from '@/client/components/auth/AuthProvider';

const { Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: '/dashboard/overview',
    icon: <DashboardOutlined />,
    label: <Link href="/dashboard/overview">Overview</Link>,
  },
  {
    key: '/dashboard/preparation',
    icon: <BookOutlined />,
    label: <Link href="/dashboard/preparation">Preparation</Link>,
  },
  {
    key: '/dashboard/trainings',
    icon: <PlayCircleOutlined />,
    label: <Link href="/dashboard/trainings">Trainings</Link>,
  },
  {
    key: '/dashboard/history',
    icon: <HistoryOutlined />,
    label: <Link href="/dashboard/history">Past Sessions</Link>,
  },
  {
    key: '/dashboard/advice',
    icon: <BulbOutlined />,
    label: <Link href="/dashboard/advice">Best Practices</Link>,
  },
  {
    key: '/dashboard/rubric',
    icon: <FileTextOutlined />,
    label: <Link href="/dashboard/rubric">Evaluation</Link>,
  },
  {
    key: '/dashboard/settings',
    icon: <SettingOutlined />,
    label: <Link href="/dashboard/settings">Settings</Link>,
  },
];

const userMenuItems: MenuProps['items'] = [
  {
    key: 'profile',
    icon: <UserOutlined />,
    label: 'Profile',
  },
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: 'Logout',
    danger: true,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    if (e.key === 'logout') {
      handleLogout();
    }
  };

  

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: '#fafafa',
          boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
          borderRight: '1px solid #f0f0f0'
        }}
        width={280}
      >
        <div style={{ 
          padding: '24px 16px', 
          marginBottom: '8px'
        }}>
          <Link href="/dashboard/overview" style={{ textDecoration: 'none' }}>
            <Space align="center">
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '18px'
              }}>
                L
              </div>
              {!collapsed && (
                <Text style={{ 
                  color: '#262626', 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  margin: 0 
                }}>
                  LearnLoop
                </Text>
              )}
            </Space>
          </Link>
        </div>
        
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          style={{ 
            border: 'none',
            background: 'transparent'
          }}
        />
      </Sider>
      
      <Layout>
        <Content
          style={{
            margin: '24px',
            padding: 0,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {/* Top controls bar */}
          <div style={{
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: colorBgContainer,
            borderRadius: `${borderRadiusLG}px ${borderRadiusLG}px 0 0`,
          }}>
            <Button 
              type="text" 
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ 
                fontSize: '16px',
                color: '#595959'
              }}
            />
            
            <Dropdown 
              menu={{ items: userMenuItems, onClick: handleMenuClick }} 
              placement="bottomRight"
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="default" icon={<UserOutlined />} />
                <Text strong>
                  {user?.user_metadata?.full_name || user?.email || 'User'}
                </Text>
              </Space>
            </Dropdown>
          </div>

          {/* Main content */}
          <div style={{ padding: '24px' }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
} 
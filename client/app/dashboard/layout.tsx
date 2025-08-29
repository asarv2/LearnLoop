"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import {
  BulbOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import {
  Avatar,
  Button,
  Dropdown,
  Layout,
  Menu,
  Space,
  theme,
  Typography,
} from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";

const { Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: "/dashboard/trainings",
    icon: <PlayCircleOutlined />,
    label: <Link href="/dashboard/trainings">Trainings</Link>,
  },
  {
    key: "/dashboard/overview",
    icon: <DashboardOutlined />,
    label: <Link href="/dashboard/overview">Overview</Link>,
  },
  {
    key: "/dashboard/history",
    icon: <HistoryOutlined />,
    label: <Link href="/dashboard/history">Past Sessions</Link>,
  },
  {
    key: "/dashboard/advice",
    icon: <BulbOutlined />,
    label: <Link href="/dashboard/advice">Best Practices</Link>,
  },
  {
    key: "/dashboard/rubric",
    icon: <FileTextOutlined />,
    label: <Link href="/dashboard/rubric">Evaluation</Link>,
  },
  // {
  //   key: "/dashboard/settings",
  //   icon: <SettingOutlined />,
  //   label: <Link href="/dashboard/settings">Settings</Link>,
  // },
];

const userMenuItems: MenuProps["items"] = [
  {
    key: "profile",
    icon: <UserOutlined />,
    label: "Profile",
  },
  {
    key: "logout",
    icon: <LogoutOutlined />,
    label: "Logout",
    danger: true,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleMenuClick: MenuProps["onClick"] = (e) => {
    if (e.key === "logout") {
      handleLogout();
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          background: "#fafafa",
          boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
          borderRight: "1px solid #f0f0f0",
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          zIndex: 1000,
        }}
        width={280}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Logo Section - Fixed at top */}
          <div
            style={{
              padding: "24px 16px",
              marginBottom: "8px",
              flexShrink: 0,
            }}
          >
            <Link
              href="/dashboard/trainings"
              style={{ textDecoration: "none" }}
            >
              <Space align="center">
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "8px",
                    background:
                      "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: "bold",
                    fontSize: "18px",
                  }}
                >
                  L
                </div>
                {!collapsed && (
                  <Text
                    style={{
                      color: "#262626",
                      fontSize: "20px",
                      fontWeight: "bold",
                      margin: 0,
                    }}
                  >
                    LearnLoop
                  </Text>
                )}
              </Space>
            </Link>
          </div>

          {/* Menu Section - Takes remaining space */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <Menu
              mode="inline"
              selectedKeys={[
                pathname.startsWith("/dashboard/trainings") ||
                pathname.startsWith("/dashboard/s/") ||
                pathname.startsWith("/dashboard/t/") ||
                pathname.startsWith("/dashboard/a/")
                  ? "/dashboard/trainings"
                  : pathname,
              ]}
              items={menuItems}
              style={{
                border: "none",
                background: "transparent",
              }}
            />
          </div>

          {/* Feedback Button - Fixed at bottom */}
          <div
            style={{
              padding: "16px",
              flexShrink: 0,
            }}
          >
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => setFeedbackModalOpen(true)}
              style={{
                width: "100%",
                height: "48px",
                background: "linear-gradient(135deg, #1890ff 0%, #0f6bb8 100%)",
                borderColor: "transparent",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "15px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: collapsed ? "0" : "10px",
                boxShadow: "0 4px 12px rgba(24, 144, 255, 0.3)",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 16px rgba(24, 144, 255, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(24, 144, 255, 0.3)";
              }}
            >
              {!collapsed && "Feedback"}
            </Button>
          </div>
        </div>
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 280 }}>
        <Content
          style={{
            margin: "24px",
            padding: 0,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          {/* Top controls bar */}
          <div
            style={{
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: colorBgContainer,
              borderRadius: `${borderRadiusLG}px ${borderRadiusLG}px 0 0`,
            }}
          >
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: "16px",
                color: "#595959",
              }}
            />

            <Dropdown
              menu={{ items: userMenuItems, onClick: handleMenuClick }}
              placement="bottomRight"
            >
              <Space style={{ cursor: "pointer" }}>
                <Avatar size="default" icon={<UserOutlined />} />
                <Text strong>
                  {user?.user_metadata?.full_name || user?.email || "User"}
                </Text>
              </Space>
            </Dropdown>
          </div>

          {/* Main content */}
          <div style={{ padding: "0px 24px" }}>{children}</div>
        </Content>
      </Layout>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
      />
    </Layout>
  );
}

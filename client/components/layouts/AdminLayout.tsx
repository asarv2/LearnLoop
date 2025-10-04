"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import FeedbackModal from "@/components/feedback/FeedbackModal";
import SuggestionsModal from "@/components/suggestions/SuggestionsModal";
import { Profile } from "@/types";
import { ViewMode } from "@/types/auth";
import {
  BarChartOutlined,
  BookOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MessageOutlined,
  ProfileOutlined,
  SwapOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import type { MenuProps } from "antd";
import {
  Avatar,
  Button,
  Dropdown,
  Layout,
  Menu,
  Space,
  Typography,
} from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";

const { Sider, Content } = Layout;
const { Text } = Typography;

const adminMenuItems = [
  {
    key: "/admin/analytics",
    icon: <BarChartOutlined />,
    label: <Link href="/admin/analytics">Analytics</Link>,
  },
  {
    key: "/admin/trainings",
    icon: <BookOutlined />,
    label: <Link href="/admin/trainings">Trainings</Link>,
  },
  {
    key: "/admin/documents",
    icon: <FileTextOutlined />,
    label: <Link href="/admin/documents">Policies</Link>,
  },
  {
    key: "/admin/employees",
    icon: <TeamOutlined />,
    label: <Link href="/admin/employees">Employees</Link>,
  },
  {
    key: "/admin/history",
    icon: <HistoryOutlined />,
    label: <Link href="/admin/history">History</Link>,
  },
  {
    key: "/admin/rubrics",
    icon: <CheckSquareOutlined />,
    label: <Link href="/admin/rubrics">Rubrics</Link>,
  },
];

const getUserMenuItems = (
  activeProfile: Profile | null,
  effectiveProfile: Profile | null,
  isEmulating: boolean,
  startEmulation: (viewMode: ViewMode) => Promise<boolean>,
  stopEmulation: () => void
): MenuProps["items"] => {
  const items: MenuProps["items"] = [];

  // Add emulation controls based on user's actual role and current state
  if (activeProfile?.role === "superadmin") {
    if (isEmulating && effectiveProfile?.role === "employee") {
      // Currently emulating employee view, show option to return to admin
      items.push({
        key: "return-to-admin",
        icon: <SwapOutlined />,
        label: "Switch to Admin View",
        onClick: async () => {
          await stopEmulation();
        },
      });
    } else if (!isEmulating) {
      // Not emulating, show option to switch to employee view
      items.push({
        key: "switch-to-employee",
        icon: <SwapOutlined />,
        label: "Switch to Employee View",
        onClick: async () => {
          await startEmulation("employee");
        },
      });
    }
  } else if (activeProfile?.role === "admin" && !isEmulating) {
    // Admin can switch to employee view
    items.push({
      key: "switch-to-employee",
      icon: <SwapOutlined />,
      label: "Switch to Employee View",
      onClick: async () => {
        await startEmulation("employee");
      },
    });
  }

  // Stop emulation option removed - users can switch back to their actual role instead

  // Add profile option
  items.push({
    key: "profile",
    icon: <ProfileOutlined />,
    label: "Profile",
    onClick: () => {
      window.location.href = "/profile";
    },
  });

  // Add divider if we have switch options
  if (items.length > 0) {
    items.push({
      type: "divider",
    });
  }

  // Add logout option
  items.push({
    key: "logout",
    icon: <LogoutOutlined />,
    label: "Logout",
    danger: true,
  });

  return items;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [collapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    signOut,
    effectiveProfile,
    activeProfile,
    isEmulating,
    startEmulation,
    stopEmulation,
  } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      queryClient.invalidateQueries({ queryKey: ["session"] });
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleMenuClick: MenuProps["onClick"] = (e) => {
    if (e.key === "logout") {
      handleLogout();
    }
    // Emulation actions are handled directly in the menu items via onClick
  };

  const handleNavMenuClick: MenuProps["onClick"] = (e) => {
    if (e.key === "feedback") setFeedbackModalOpen(true);
    if (e.key === "suggestions") setSuggestionsOpen(true);
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Vertical Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          background: "#ffffff",
          borderRight: "1px solid #e8e8e8",
          boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        width={280}
        collapsedWidth={80}
      >
        {/* Logo Section */}
        <div
          style={{
            padding: "24px 16px",
            borderBottom: "1px solid #f0f0f0",
            textAlign: collapsed ? "center" : "left",
          }}
        >
          <Link href="/admin/analytics" style={{ textDecoration: "none" }}>
            <Space align="center" size="middle">
              <div
                style={{
                  width: "36px",
                  height: "36px",
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

        {/* Navigation Menu */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={adminMenuItems}
            onClick={handleNavMenuClick}
            style={{
              border: "none",
              background: "transparent",
              padding: "16px 0",
            }}
          />
        </div>

        {/* Suggestions shortcut at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 72,
            left: 0,
            right: 0,
            padding: "12px 16px",
            borderTop: "1px solid #f0f0f0",
            background: "#ffffff",
          }}
        >
          <Button
            type="default"
            icon={<MessageOutlined />}
            onClick={() => setSuggestionsOpen(true)}
            style={{ width: "100%" }}
          >
            {!collapsed && "Suggestions"}
          </Button>
        </div>

        {/* User Section at Bottom */}
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid #f0f0f0",
            background: "#ffffff",
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <Dropdown
            menu={{
              items: getUserMenuItems(
                activeProfile,
                effectiveProfile,
                isEmulating,
                startEmulation,
                stopEmulation
              ),
              onClick: handleMenuClick,
            }}
            placement="topRight"
          >
            <Space style={{ cursor: "pointer", width: "100%" }} size="small">
              <Avatar size="default" icon={<UserOutlined />} />
              {!collapsed && (
                <div style={{ flex: 1 }}>
                  <Text strong style={{ color: "#262626" }}>
                    {effectiveProfile?.name || "User"}
                  </Text>
                  {isEmulating && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#1890ff",
                        marginTop: "2px",
                      }}
                    >
                      Viewing as {effectiveProfile?.role}
                    </div>
                  )}
                </div>
              )}
            </Space>
          </Dropdown>
        </div>
      </Sider>

      {/* Main Content */}
      <Layout style={{ marginLeft: collapsed ? 80 : 280 }}>
        <Content
          style={{
            padding: "32px 24px",
            background: "#fafafa",
            minHeight: "100vh",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              padding: "32px",
              minHeight: "calc(100vh - 64px)",
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
      />
      <SuggestionsModal
        open={suggestionsOpen}
        onClose={() => setSuggestionsOpen(false)}
      />
    </Layout>
  );
}

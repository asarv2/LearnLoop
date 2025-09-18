"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import SuggestionsModal from "@/components/suggestions/SuggestionsModal";
import { useRole } from "@/contexts/role-context";
import { LogoutOutlined, SwapOutlined, UserOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
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
import React, { useEffect, useState } from "react";

const { Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: "/dashboard/trainings",
    label: <Link href="/dashboard/trainings">Trainings</Link>,
  },
  {
    key: "/dashboard/overview",
    label: <Link href="/dashboard/overview">Analytics</Link>,
  },
  {
    key: "/dashboard/history",
    label: <Link href="/dashboard/history">History</Link>,
  },
  {
    key: "/dashboard/requests",
    label: <Link href="/dashboard/requests">Requests</Link>,
  },
  {
    key: "suggestions",
    label: "Suggestions",
  },
  // {
  //   key: "/dashboard/settings",
  //   icon: <SettingOutlined />,
  //   label: <Link href="/dashboard/settings">Settings</Link>,
  // },
];

const userMenuItems: MenuProps["items"] = [
  // {
  //   key: "profile",
  //   icon: <UserOutlined />,
  //   label: "Profile",
  // },
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
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { userRole, loading, switchToAdmin, currentView } = useRole();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // Redirect admin users to admin interface if they're not in employee view
  useEffect(() => {
    if (
      !loading &&
      (userRole === "admin" ||
        (userRole === "superadmin" && currentView === "admin"))
    ) {
      router.push("/admin/analytics");
    }
  }, [userRole, loading, currentView, router]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

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
  };

  const handleNavMenuClick: MenuProps["onClick"] = (e) => {
    if (e.key === "suggestions") {
      setFeedbackModalOpen(true);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Horizontal Navigation Header */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e8e8e8",
          padding: "0 24px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "64px",
          }}
        >
          {/* Left side - Logo */}
          <Link href="/dashboard/trainings" style={{ textDecoration: "none" }}>
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
              <Text
                style={{
                  color: "#262626",
                  fontSize: "22px",
                  fontWeight: "bold",
                  margin: 0,
                }}
              >
                LearnLoop
              </Text>
            </Space>
          </Link>

          {/* Center - Navigation Menu */}
          <Menu
            mode="horizontal"
            selectedKeys={[
              pathname.startsWith("/dashboard/trainings") ||
              pathname.startsWith("/dashboard/s/") ||
              pathname.startsWith("/dashboard/t/") ||
              pathname.startsWith("/dashboard/a/")
                ? "/dashboard/trainings"
                : pathname,
            ]}
            items={menuItems}
            onClick={handleNavMenuClick}
            style={{
              border: "none",
              background: "transparent",
              justifyContent: "center",
              fontSize: "15px",
              fontWeight: "500",
              flex: 1,
              minWidth: 0,
            }}
          />

          {/* Right side - Admin switch and User dropdown */}
          <Space size="middle">
            {/* Admin switch for superadmin users */}
            {userRole === "superadmin" && currentView === "employee" && (
              <Button
                type="primary"
                icon={<SwapOutlined />}
                onClick={switchToAdmin}
                size="small"
              >
                Admin View
              </Button>
            )}

            <Dropdown
              menu={{ items: userMenuItems, onClick: handleMenuClick }}
              placement="bottomRight"
            >
              <Space style={{ cursor: "pointer" }} size="small">
                <Avatar size="default" icon={<UserOutlined />} />
                <Text strong style={{ color: "#262626" }}>
                  {user?.user_metadata?.full_name || user?.email || "User"}
                </Text>
              </Space>
            </Dropdown>
          </Space>
        </div>
      </div>

      {/* Main Content */}
      <Content
        style={{
          padding: "32px 24px",
          background: "#fafafa",
          minHeight: "calc(100vh - 64px)",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            padding: "32px",
            minHeight: "calc(100vh - 128px)",
          }}
        >
          {children}
        </div>
      </Content>

      {/* Suggestions modal */}
      <SuggestionsModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
      />
    </Layout>
  );
}

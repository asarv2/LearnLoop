"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import SuggestionsModal from "@/components/suggestions/SuggestionsModal";
import { useRole } from "@/contexts/role-context";
import {
  LogoutOutlined,
  MessageOutlined,
  ProfileOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import type { MenuProps } from "antd";
import { Avatar, Button, Dropdown, Layout, Space, Typography } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const { Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: "/dashboard/trainings",
    label: "Trainings",
  },
  {
    key: "/dashboard/overview",
    label: "Analytics",
  },
  {
    key: "/dashboard/history",
    label: "History",
  },
  // {
  //   key: "/dashboard/settings",
  //   icon: <SettingOutlined />,
  //   label: <Link href="/dashboard/settings">Settings</Link>,
  // },
];

const getUserMenuItems = (
  userRole: string | null,
  currentView: "employee" | "admin",
  switchToAdmin: () => void,
  switchToEmployee: () => void
): MenuProps["items"] => {
  const items: MenuProps["items"] = [];

  // Add view switch options for superadmin users
  if (userRole === "superadmin") {
    if (currentView === "employee") {
      items.push({
        key: "switch-to-admin",
        icon: <SwapOutlined />,
        label: "Switch to Admin View",
        onClick: switchToAdmin,
      });
    } else {
      items.push({
        key: "switch-to-employee",
        icon: <SwapOutlined />,
        label: "Switch to Employee View",
        onClick: switchToEmployee,
      });
    }
  }

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
  const { userRole, loading, switchToAdmin, switchToEmployee, currentView } =
    useRole();

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
    // Note: Switch actions are handled directly in the menu items via onClick
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
            height: "64px",
            position: "relative",
          }}
        >
          {/* Left side - Logo */}
          <div style={{ position: "absolute", left: "24px" }}>
            <Link
              href="/dashboard/trainings"
              style={{ textDecoration: "none" }}
            >
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
          </div>

          {/* Center - Navigation Menu */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "32px",
            }}
          >
            {menuItems.map((item) => {
              const isSelected =
                item.key === "/dashboard/trainings"
                  ? pathname.startsWith("/dashboard/trainings") ||
                    pathname.startsWith("/dashboard/s/") ||
                    pathname.startsWith("/dashboard/t/") ||
                    pathname.startsWith("/dashboard/a/")
                  : pathname === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.key}
                  style={{
                    textDecoration: "none",
                    color: isSelected ? "#1890ff" : "#262626",
                    fontSize: "15px",
                    fontWeight: "500",
                    padding: "8px 0",
                    borderBottom: isSelected
                      ? "2px solid #1890ff"
                      : "2px solid transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right side - Suggestions button and User dropdown */}
          <div style={{ position: "absolute", right: "24px" }}>
            <Space size="middle">
              {/* Suggestions button */}
              <Button
                type="default"
                icon={<MessageOutlined />}
                onClick={() => setFeedbackModalOpen(true)}
                style={{
                  border: "1px solid #d9d9d9",
                  borderRadius: "6px",
                  height: "36px",
                  padding: "4px 12px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#262626",
                  background: "#ffffff",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                Suggestions
              </Button>

              {/* User dropdown */}
              <Dropdown
                menu={{
                  items: getUserMenuItems(
                    userRole,
                    currentView,
                    switchToAdmin,
                    switchToEmployee
                  ),
                  onClick: handleMenuClick,
                }}
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

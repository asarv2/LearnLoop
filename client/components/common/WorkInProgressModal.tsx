"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Card } from "antd";
import { useEffect, useState } from "react";

interface WorkInProgressModalProps {
  title: string;
  description: string;
}

export default function WorkInProgressModal({
  title,
  description,
}: WorkInProgressModalProps) {
  const [isClient, setIsClient] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);

  useEffect(() => {
    setIsClient(true);

    // Check if sidebar is collapsed by looking for the collapsed class
    const checkSidebarState = () => {
      const sidebar = document.querySelector(".ant-layout-sider");
      if (sidebar) {
        const isCollapsed = sidebar.classList.contains(
          "ant-layout-sider-collapsed"
        );
        setSidebarWidth(isCollapsed ? 80 : 280);
      }
    };

    checkSidebarState();

    // Listen for sidebar toggle events
    const observer = new MutationObserver(checkSidebarState);
    const sidebar = document.querySelector(".ant-layout-sider");
    if (sidebar) {
      observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => observer.disconnect();
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <>
      {/* Custom overlay that only covers the main content area */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: `${sidebarWidth}px`, // Dynamic based on sidebar state
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.15)", // Very subtle dark tint
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto", // Block interactions with background
        }}
      >
        <Card
          style={{
            width: 480,
            maxWidth: "90vw",
            boxShadow:
              "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
            borderRadius: "8px",
            zIndex: 501,
            pointerEvents: "auto", // Allow interactions with the modal itself
          }}
          styles={{
            body: {
              padding: "24px",
              textAlign: "center",
            },
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
              paddingBottom: "16px",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <ExclamationCircleOutlined style={{ color: "#faad14" }} />
            <span style={{ fontSize: "18px", fontWeight: "600" }}>
              Work in Progress
            </span>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#262626",
                margin: "0 0 12px 0",
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: "16px",
                color: "#595959",
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              {description}
            </p>
          </div>

          <div
            style={{
              padding: "16px",
              background: "#f6f8fa",
              borderRadius: "8px",
              border: "1px solid #e1e4e8",
            }}
          >
            <p
              style={{
                fontSize: "14px",
                color: "#6a737d",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              This feature is currently under development. Please check back
              soon for updates.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

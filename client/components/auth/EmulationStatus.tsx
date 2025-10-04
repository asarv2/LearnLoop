"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Tag } from "antd";

export function EmulationStatus() {
  const { activeProfile, effectiveProfile, isEmulating } = useAuth();

  if (!activeProfile) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Tag color="blue">Actual: {activeProfile.role}</Tag>
      {isEmulating && (
        <Tag color="green">Viewing as: {effectiveProfile?.role}</Tag>
      )}
    </div>
  );
}

/**
 * InterviewHomepage.tsx
 * @deprecated - Replaced with new dashboard structure
 * Redirects to new dashboard
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InterviewHomepage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new dashboard
    router.push("/dashboard/trainings");
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f5f5f5",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #1890ff 0%, #722ed1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
          }}
        >
          L
        </div>
        <p style={{ color: "#8c8c8c" }}>Redirecting to Training...</p>
      </div>
    </div>
  );
}

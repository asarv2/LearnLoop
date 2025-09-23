"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import LandingPage from "@/components/LandingPage";
import { useRole } from "@/contexts/role-context";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { userRole, loading: roleLoading, currentView } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const redirectedRef = useRef(false);

  // Decide the destination once
  const targetPath = useMemo(() => {
    if (!user) return null;
    const isAdminView =
      userRole === "admin" ||
      (userRole === "superadmin" && currentView === "admin");
    return isAdminView ? "/admin/analytics" : "/dashboard/trainings";
  }, [user, userRole, currentView]);

  useEffect(() => {
    // Only redirect:
    // - once
    // - when auth + role are settled
    // - when we're actually on the home page
    if (
      !redirectedRef.current &&
      !authLoading &&
      !roleLoading &&
      user &&
      targetPath &&
      pathname === "/"
    ) {
      redirectedRef.current = true;
      router.replace(targetPath);
    }
  }, [authLoading, roleLoading, user, targetPath, pathname, router]);

  // Loading states while we wait for auth/role to settle
  if (authLoading || roleLoading) {
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
          <p style={{ color: "#8c8c8c" }}>Loading LearnLoop...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, they'll be redirected, so we can show loading
  if (user) {
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
          <p style={{ color: "#8c8c8c" }}>
            Redirecting to{" "}
            {targetPath === "/admin/analytics" ? "Admin" : "Training"}…
          </p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  return <LandingPage />;
}

"use client";

import AdminLayout from "@/components/layouts/AdminLayout";
import { useRole } from "@/contexts/role-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && userRole !== "admin" && userRole !== "superadmin") {
      // Redirect non-admin users to the employee dashboard
      router.push("/dashboard/trainings");
    }
  }, [userRole, loading, router]);

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

  if (userRole !== "admin" && userRole !== "superadmin") {
    return null; // Will redirect
  }

  return <AdminLayout>{children}</AdminLayout>;
}

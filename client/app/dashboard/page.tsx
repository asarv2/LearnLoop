"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to trainings when accessing /dashboard directly
    router.replace("/dashboard/trainings");
  }, [router]);

  return null;
}

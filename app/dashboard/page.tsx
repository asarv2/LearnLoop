"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to overview when accessing /dashboard directly
    router.replace('/dashboard/overview');
  }, [router]);

  return null;
} 
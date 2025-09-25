// lib/api/hooks/useAnalytics.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../fetcher";

export type AnalyticsData = {
  totalEmployees: number;
  activeTrainings: number;
  completedSessions: number;
  avgSessionTime: number;
  avgPerformanceScore: number;
  companyTrainingStats: Record<
    string,
    Record<string, { total: number; completed: number }>
  >;
  recentActivity: Array<{
    id: string;
    title: string;
    completed_at: string;
    profile_id: string;
    profiles: {
      name: string;
      company: string | null;
    };
  }>;
  performanceData: Array<{
    score: number;
    chat_id: string;
    chats: {
      profile_id: string;
      profiles: {
        company: string | null;
      };
    };
  }>;
  employees: Array<{
    id: string;
    name: string;
    company: string | null;
    role: string | null;
    active: boolean | null;
  }>;
};

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => api<AnalyticsData>("/api/v1/analytics"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

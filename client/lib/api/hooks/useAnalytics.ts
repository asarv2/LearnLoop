// lib/api/hooks/useAnalytics.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../fetcher";

export type AnalyticsData = {
  totalEmployees: number;
  activeTrainings: number;
  completedSessions: number;
  avgSessionTime: number;
  avgPerformanceScore: number;
  avgTrainingScore: number;
  bestTraining: {
    name: string;
    score: number;
  };
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
  performanceChart: Array<{
    date: string;
    averageScore: number;
    completions: number;
  }>;
  completionChart: Array<{
    date: string;
    count: number;
  }>;
  engagementMetrics: Array<{
    id: string;
    name: string;
    company: string | null;
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
    averageScore: number;
    lastActive: string | null;
  }>;
  effectivenessData: Array<{
    title: string;
    type: string;
    averageScore: number;
    completions: number;
    effectiveness: "High" | "Medium" | "Low";
  }>;
  performanceTrends: Array<{
    date: string;
    score: number;
    employeeName: string;
    trainingName: string;
  }>;
  trainingsByType: {
    standard: Array<{
      id: string;
      title: string;
      training_type: string;
    }>;
    required: Array<{
      id: string;
      title: string;
      training_type: string;
    }>;
    custom: Array<{
      id: string;
      title: string;
      training_type: string;
    }>;
  };
  trainingSpecificData: Array<{
    date: string;
    score: number;
    trainingId: string;
    trainingTitle: string;
    trainingType: string;
  }>;
};

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => api<AnalyticsData>("/api/v1/analytics"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

import { api } from "@/lib/api/fetcher";
import { useQuery } from "@tanstack/react-query";

export interface Rubric {
  id: string;
  name: string;
  description: string | null;
  total_points: number | null;
  standard_length: number | null;
  created_at: string | null;
  updated_at: string | null;
  company: string | null;
}

export interface Standard {
  id: string;
  name: string;
  description: string | null;
  items: string[] | null;
  order_index: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RubricWithStandards {
  rubric: {
    id: string;
    name: string;
    company: string | null;
  };
  standards: Standard[];
}

export function useRubrics(company: string | null) {
  return useQuery({
    queryKey: ["rubrics", company],
    queryFn: () =>
      api<Rubric[]>(
        `/api/v1/rubrics?company=${encodeURIComponent(company || "")}`
      ),
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
}

export function useRubricStandards(rubricId: string | null) {
  return useQuery({
    queryKey: ["rubric-standards", rubricId],
    queryFn: () =>
      api<RubricWithStandards>(`/api/v1/rubrics/${rubricId}/standards`),
    enabled: !!rubricId,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export interface RubricGrade {
  id: string;
  chat_id: string;
  score: number;
  strengths: string[];
  improvements: string[];
  created_at: string;
}

export function useAllRubricGrades() {
  return useQuery({
    queryKey: ["rubric-grades"],
    queryFn: () => api<RubricGrade[]>("/api/v1/rubric-grades"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

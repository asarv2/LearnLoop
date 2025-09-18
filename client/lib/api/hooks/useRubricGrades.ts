// lib/api/hooks/useRubricGrades.ts
import type { RubricGrade } from "@/lib/repos/rubricRepo";
import { useQuery } from "@tanstack/react-query";
import { api } from "../fetcher";
import { rubricGradeKeys } from "../keys";

// ---------- Queries ----------
export function useRubricGrades() {
  return useQuery({
    queryKey: rubricGradeKeys.list(),
    queryFn: () => api<RubricGrade[]>("/api/v1/rubrics/grades"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useRubricGradesByChat(chatId: string, enabled = true) {
  return useQuery({
    queryKey: rubricGradeKeys.listByChat(chatId),
    queryFn: () => api<RubricGrade[]>(`/api/v1/chats/${chatId}/grades`),
    enabled: enabled && !!chatId,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useRubricGrade(id: string, enabled = true) {
  return useQuery({
    queryKey: rubricGradeKeys.detail(id),
    queryFn: () => api<RubricGrade>(`/api/v1/rubrics/grades/${id}`),
    enabled,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

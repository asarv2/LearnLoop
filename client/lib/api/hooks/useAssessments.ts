// lib/api/hooks/useAssessments.ts
import type {
  AssessmentCreate,
  AssessmentFeedback,
  AssessmentUpdate,
} from "@/lib/repos/assessmentRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { assessmentKeys } from "../keys";

// ---------- Queries ----------
export function useAssessments() {
  return useQuery({
    queryKey: assessmentKeys.list(),
    queryFn: () => api<AssessmentCreate[]>("/api/v1/assessments"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useAssessment(id: string, enabled = true) {
  return useQuery({
    queryKey: assessmentKeys.detail(id),
    queryFn: () => api<AssessmentCreate>(`/api/v1/assessments/${id}`),
    enabled,
  });
}

export function useAssessmentFeedback(assessmentId: string, enabled = true) {
  return useQuery({
    queryKey: [...assessmentKeys.detail(assessmentId), "feedback"],
    queryFn: () =>
      api<AssessmentFeedback[]>(`/api/v1/assessments/${assessmentId}/feedback`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssessmentCreate) =>
      api<AssessmentCreate>("/api/v1/assessments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: assessmentKeys.all });
    },
  });
}

export function useUpdateAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AssessmentUpdate) =>
      api<AssessmentCreate>(`/api/v1/assessments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: assessmentKeys.detail(id) });
    },
  });
}

export function useDeleteAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/assessments/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: assessmentKeys.all });
    },
  });
}

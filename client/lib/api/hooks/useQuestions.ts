// lib/api/hooks/useQuestions.ts
import type { QuestionCreate, QuestionUpdate } from "@/lib/repos/questionRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { questionKeys } from "../keys";

// ---------- Queries ----------
export function useQuestions() {
  return useQuery({
    queryKey: questionKeys.list(),
    queryFn: () => api<QuestionCreate[]>("/api/v1/questions"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useQuestion(id: string, enabled = true) {
  return useQuery({
    queryKey: questionKeys.detail(id),
    queryFn: () => api<QuestionCreate>(`/api/v1/questions/${id}`),
    enabled,
  });
}

export function useQuestionsByAssessment(assessmentId: string, enabled = true) {
  return useQuery({
    queryKey: [...questionKeys.all, "assessment", assessmentId],
    queryFn: () =>
      api<QuestionCreate[]>(`/api/v1/assessments/${assessmentId}/questions`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: QuestionCreate) =>
      api<QuestionCreate>("/api/v1/questions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: questionKeys.all });
    },
  });
}

export function useUpdateQuestion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: QuestionUpdate) =>
      api<QuestionCreate>(`/api/v1/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: questionKeys.detail(id) });
    },
  });
}

export function useDeleteQuestion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/questions/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: questionKeys.all });
    },
  });
}

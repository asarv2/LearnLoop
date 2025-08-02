// lib/api/hooks/useRubrics.ts
import type {
  RubricCreate,
  RubricGrade,
  RubricUpdate,
} from "@/lib/repos/rubricRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { rubricKeys } from "../keys";

// ---------- Queries ----------
export function useRubrics() {
  return useQuery({
    queryKey: rubricKeys.list(),
    queryFn: () => api<RubricCreate[]>("/api/v1/rubrics"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useRubric(id: string, enabled = true) {
  return useQuery({
    queryKey: rubricKeys.detail(id),
    queryFn: () => api<RubricCreate>(`/api/v1/rubrics/${id}`),
    enabled,
  });
}

export function useRubricGrades(rubricId: string, enabled = true) {
  return useQuery({
    queryKey: [...rubricKeys.detail(rubricId), "grades"],
    queryFn: () => api<RubricGrade[]>(`/api/v1/rubrics/${rubricId}/grades`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateRubric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RubricCreate) =>
      api<RubricCreate>("/api/v1/rubrics", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: rubricKeys.all });
    },
  });
}

export function useUpdateRubric(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: RubricUpdate) =>
      api<RubricCreate>(`/api/v1/rubrics/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: rubricKeys.detail(id) });
    },
  });
}

export function useDeleteRubric(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/rubrics/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: rubricKeys.all });
    },
  });
}

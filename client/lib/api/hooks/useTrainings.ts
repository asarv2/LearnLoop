// lib/api/hooks/useTrainings.ts
import type { TrainingCreate, TrainingUpdate } from "@/lib/repos/trainingRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { trainingKeys } from "../keys";

// ---------- Queries ----------
export function useTrainings() {
  return useQuery({
    queryKey: trainingKeys.list(),
    queryFn: () => api<TrainingCreate[]>("/api/v1/trainings"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useTrainingsPractice() {
  return useQuery({
    queryKey: [...trainingKeys.list(), "practice"],
    queryFn: () => api<TrainingCreate[]>("/api/v1/trainings?practice=true"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useTraining(id: string, enabled = true) {
  return useQuery({
    queryKey: trainingKeys.detail(id),
    queryFn: () => api<TrainingCreate>(`/api/v1/trainings/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TrainingCreate) =>
      api<TrainingCreate>("/api/v1/trainings", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: trainingKeys.all });
    },
  });
}

export function useUpdateTraining(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: TrainingUpdate) =>
      api<TrainingCreate>(`/api/v1/trainings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: trainingKeys.detail(id) });
    },
  });
}

export function useDeleteTraining(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/trainings/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: trainingKeys.all });
    },
  });
}

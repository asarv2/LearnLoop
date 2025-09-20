// lib/api/hooks/useTrainings.ts
import type {
  TrainingCreate,
  TrainingUpdate,
  TrainingWithAllIncludes,
} from "@/lib/repos/trainingRepo";
import { logInfo } from "@/utils/logger";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { trainingKeys } from "../keys";

// ---------- Queries ----------
export function useTrainings() {
  return useQuery({
    queryKey: trainingKeys.list(),
    queryFn: () => {
      logInfo("Fetching trainings list");
      return api<TrainingCreate[]>("/api/v1/trainings");
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useTrainingsPractice() {
  return useQuery({
    queryKey: [...trainingKeys.list(), "practice"],
    queryFn: () => {
      logInfo("Fetching practice trainings list");
      return api<TrainingCreate[]>("/api/v1/trainings?practice=true");
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useTrainingsByType(type: "standard" | "required" | "custom") {
  return useQuery({
    queryKey: [...trainingKeys.list(), "type", type],
    queryFn: () => {
      logInfo(`Fetching ${type} trainings list`);
      return api<TrainingCreate[]>(`/api/v1/trainings?type=${type}`);
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useCustomTrainingsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: [...trainingKeys.list(), "custom", "user", userId],
    queryFn: () => {
      logInfo(`Fetching custom trainings for user: ${userId}`);
      return api<TrainingCreate[]>(
        `/api/v1/trainings?type=custom&userId=${userId}`
      );
    },
    enabled: !!userId,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useTraining(id: string, enabled = true) {
  return useQuery({
    queryKey: trainingKeys.detail(id),
    queryFn: () => {
      logInfo(`Fetching training detail: ${id}`);
      return api<TrainingWithAllIncludes>(`/api/v1/trainings/${id}`);
    },
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TrainingCreate) => {
      logInfo("Creating new training", payload);
      return api<TrainingCreate>("/api/v1/trainings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess() {
      logInfo("Training created successfully, invalidating queries");
      qc.invalidateQueries({ queryKey: trainingKeys.all });
    },
  });
}

export function useUpdateTraining(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: TrainingUpdate) => {
      logInfo(`Updating training: ${id}`, patch);
      return api<TrainingCreate>(`/api/v1/trainings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onSuccess() {
      logInfo(`Training ${id} updated successfully, invalidating queries`);
      qc.invalidateQueries({ queryKey: trainingKeys.detail(id) });
    },
  });
}

export function useDeleteTraining(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      logInfo(`Deleting training: ${id}`);
      return api<void>(`/api/v1/trainings/${id}`, { method: "DELETE" });
    },
    onSuccess() {
      logInfo(`Training ${id} deleted successfully, invalidating queries`);
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: trainingKeys.all });
    },
  });
}

// lib/api/hooks/useLogs.ts
import type { LogCreate, LogUpdate } from "@/lib/repos/logRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { logKeys } from "../keys";

// ---------- Queries ----------
export function useLogs() {
  return useQuery({
    queryKey: logKeys.list(),
    queryFn: () => api<LogCreate[]>("/api/v1/logs"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useLog(id: string, enabled = true) {
  return useQuery({
    queryKey: logKeys.detail(id),
    queryFn: () => api<LogCreate>(`/api/v1/logs/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function createLog() {
  return async (payload: LogCreate) =>
    api<LogCreate>("/api/v1/logs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
}

export function useUpdateLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: LogUpdate) =>
      api<LogCreate>(`/api/v1/logs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: logKeys.detail(id) });
    },
  });
}

export function useDeleteLog(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/logs/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: logKeys.all });
    },
  });
}

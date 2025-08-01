// lib/api/hooks/useScenarios.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scenarioKeys } from '../keys';
import type {
  ScenarioCreate,
  ScenarioUpdate,
} from '@/lib/repos/scenarioRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useScenarios() {
  return useQuery({
    queryKey: scenarioKeys.list(),
    queryFn: () => api<ScenarioCreate[]>('/api/v1/scenarios'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useScenario(id: string, enabled = true) {
  return useQuery({
    queryKey: scenarioKeys.detail(id),
    queryFn: () => api<ScenarioCreate>(`/api/v1/scenarios/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioCreate) =>
      api<ScenarioCreate>('/api/v1/scenarios', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: scenarioKeys.all });
    },
  });
}

export function useUpdateScenario(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ScenarioUpdate) =>
      api<ScenarioCreate>(`/api/v1/scenarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: scenarioKeys.detail(id) });
    },
  });
}

export function useDeleteScenario(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/scenarios/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: scenarioKeys.all });
    },
  });
} 
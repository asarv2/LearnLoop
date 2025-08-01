// lib/api/hooks/useParameters.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parameterKeys } from '../keys';
import type {
  ParameterCreate,
  ParameterUpdate,
} from '@/lib/repos/parameterRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useParameters() {
  return useQuery({
    queryKey: parameterKeys.list(),
    queryFn: () => api<ParameterCreate[]>('/api/v1/parameters'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useParameter(id: string, enabled = true) {
  return useQuery({
    queryKey: parameterKeys.detail(id),
    queryFn: () => api<ParameterCreate>(`/api/v1/parameters/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParameterCreate) =>
      api<ParameterCreate>('/api/v1/parameters', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: parameterKeys.all });
    },
  });
}

export function useUpdateParameter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ParameterUpdate) =>
      api<ParameterCreate>(`/api/v1/parameters/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: parameterKeys.detail(id) });
    },
  });
}

export function useDeleteParameter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/parameters/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: parameterKeys.all });
    },
  });
} 
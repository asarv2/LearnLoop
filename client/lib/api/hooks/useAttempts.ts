// lib/api/hooks/useAttempts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attemptKeys } from '../keys';
import type {
  AttemptCreate,
  AttemptUpdate,
} from '@/lib/repos/attemptRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useAttempts() {
  return useQuery({
    queryKey: attemptKeys.list(),
    queryFn: () => api<AttemptCreate[]>('/api/v1/attempts'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useAttemptsWithTraining() {
  return useQuery({
    queryKey: [...attemptKeys.list(), 'with-training'],
    queryFn: () => api<AttemptCreate[]>('/api/v1/attempts?include=training'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useAttempt(id: string, enabled = true) {
  return useQuery({
    queryKey: attemptKeys.detail(id),
    queryFn: () => api<AttemptCreate>(`/api/v1/attempts/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttemptCreate) =>
      api<AttemptCreate>('/api/v1/attempts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: attemptKeys.all });
    },
  });
}

export function useUpdateAttempt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AttemptUpdate) =>
      api<AttemptCreate>(`/api/v1/attempts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: attemptKeys.detail(id) });
    },
  });
}

export function useDeleteAttempt(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/attempts/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: attemptKeys.all });
    },
  });
} 
// lib/api/hooks/useHints.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hintKeys } from '../keys';
import type {
  HintCreate,
  HintUpdate,
} from '@/lib/repos/hintRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useHints() {
  return useQuery({
    queryKey: hintKeys.list(),
    queryFn: () => api<HintCreate[]>('/api/v1/hints'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useHint(id: string, enabled = true) {
  return useQuery({
    queryKey: hintKeys.detail(id),
    queryFn: () => api<HintCreate>(`/api/v1/hints/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateHint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: HintCreate) =>
      api<HintCreate>('/api/v1/hints', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: hintKeys.all });
    },
  });
}

export function useUpdateHint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: HintUpdate) =>
      api<HintCreate>(`/api/v1/hints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: hintKeys.detail(id) });
    },
  });
}

export function useDeleteHint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/hints/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: hintKeys.all });
    },
  });
} 
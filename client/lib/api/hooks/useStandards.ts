// lib/api/hooks/useStandards.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { standardKeys } from '../keys';
import type {
  StandardCreate,
  StandardUpdate,
  StandardGrade,
} from '@/lib/repos/standardRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useStandards() {
  return useQuery({
    queryKey: standardKeys.list(),
    queryFn: () => api<StandardCreate[]>('/api/v1/standards'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useStandard(id: string, enabled = true) {
  return useQuery({
    queryKey: standardKeys.detail(id),
    queryFn: () => api<StandardCreate>(`/api/v1/standards/${id}`),
    enabled,
  });
}

export function useStandardGrades(standardId: string, enabled = true) {
  return useQuery({
    queryKey: [...standardKeys.detail(standardId), 'grades'],
    queryFn: () => api<StandardGrade[]>(`/api/v1/standards/${standardId}/grades`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StandardCreate) =>
      api<StandardCreate>('/api/v1/standards', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: standardKeys.all });
    },
  });
}

export function useUpdateStandard(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: StandardUpdate) =>
      api<StandardCreate>(`/api/v1/standards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: standardKeys.detail(id) });
    },
  });
}

export function useDeleteStandard(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/standards/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: standardKeys.all });
    },
  });
} 
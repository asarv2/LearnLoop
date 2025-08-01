// lib/api/hooks/useFields.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fieldKeys } from '../keys';
import type {
  FieldCreate,
  FieldUpdate,
} from '@/lib/repos/fieldRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useFields() {
  return useQuery({
    queryKey: fieldKeys.list(),
    queryFn: () => api<FieldCreate[]>('/api/v1/fields'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useField(id: string, enabled = true) {
  return useQuery({
    queryKey: fieldKeys.detail(id),
    queryFn: () => api<FieldCreate>(`/api/v1/fields/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FieldCreate) =>
      api<FieldCreate>('/api/v1/fields', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: fieldKeys.all });
    },
  });
}

export function useUpdateField(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: FieldUpdate) =>
      api<FieldCreate>(`/api/v1/fields/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: fieldKeys.detail(id) });
    },
  });
}

export function useDeleteField(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/fields/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: fieldKeys.all });
    },
  });
} 
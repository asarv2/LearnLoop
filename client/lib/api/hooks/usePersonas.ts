// lib/api/hooks/usePersonas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personaKeys } from '../keys';
import type {
  PersonaCreate,
  PersonaUpdate,
} from '@/lib/repos/personaRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function usePersonas() {
  return useQuery({
    queryKey: personaKeys.list(),
    queryFn: () => api<PersonaCreate[]>('/api/v1/personas'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function usePersona(id: string, enabled = true) {
  return useQuery({
    queryKey: personaKeys.detail(id),
    queryFn: () => api<PersonaCreate>(`/api/v1/personas/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PersonaCreate) =>
      api<PersonaCreate>('/api/v1/personas', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: personaKeys.all });
    },
  });
}

export function useUpdatePersona(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PersonaUpdate) =>
      api<PersonaCreate>(`/api/v1/personas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: personaKeys.detail(id) });
    },
  });
}

export function useDeletePersona(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/personas/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: personaKeys.all });
    },
  });
} 
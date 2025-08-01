// lib/api/hooks/useMessages.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageKeys } from '../keys';
import type {
  MessageCreate,
  MessageUpdate,
  MessageHint,
} from '@/lib/repos/messageRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useMessages() {
  return useQuery({
    queryKey: messageKeys.list(),
    queryFn: () => api<MessageCreate[]>('/api/v1/messages'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useMessage(id: string, enabled = true) {
  return useQuery({
    queryKey: messageKeys.detail(id),
    queryFn: () => api<MessageCreate>(`/api/v1/messages/${id}`),
    enabled,
  });
}

export function useMessageHints(messageId: string, enabled = true) {
  return useQuery({
    queryKey: [...messageKeys.detail(messageId), 'hints'],
    queryFn: () => api<MessageHint[]>(`/api/v1/messages/${messageId}/hints`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MessageCreate) =>
      api<MessageCreate>('/api/v1/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
}

export function useUpdateMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: MessageUpdate) =>
      api<MessageCreate>(`/api/v1/messages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: messageKeys.detail(id) });
    },
  });
}

export function useDeleteMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/messages/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: messageKeys.all });
    },
  });
} 
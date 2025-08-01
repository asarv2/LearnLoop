// lib/api/hooks/useChats.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '../keys';
import type {
  ChatCreate,
  ChatUpdate,
} from '@/lib/repos/chatRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useChats() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => api<ChatCreate[]>('/api/v1/chats'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useChat(id: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.detail(id),
    queryFn: () => api<ChatCreate>(`/api/v1/chats/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChatCreate) =>
      api<ChatCreate>('/api/v1/chats', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
}

export function useUpdateChat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ChatUpdate) =>
      api<ChatCreate>(`/api/v1/chats/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: chatKeys.detail(id) });
    },
  });
}

export function useDeleteChat(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/chats/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: chatKeys.all });
    },
  });
} 
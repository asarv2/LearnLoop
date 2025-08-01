// lib/api/hooks/useFeedback.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackKeys } from '../keys';
import type {
  FeedbackCreate,
  FeedbackUpdate,
} from '@/lib/repos/feedbackRepo';
import { api } from '../fetcher';

// ---------- Queries ----------
export function useFeedback() {
  return useQuery({
    queryKey: feedbackKeys.list(),
    queryFn: () => api<FeedbackCreate[]>('/api/v1/feedback'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useFeedbackItem(id: string, enabled = true) {
  return useQuery({
    queryKey: feedbackKeys.detail(id),
    queryFn: () => api<FeedbackCreate>(`/api/v1/feedback/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FeedbackCreate) =>
      api<FeedbackCreate>('/api/v1/feedback', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: feedbackKeys.all });
    },
  });
}

export function useUpdateFeedback(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: FeedbackUpdate) =>
      api<FeedbackCreate>(`/api/v1/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: feedbackKeys.detail(id) });
    },
  });
}

export function useDeleteFeedback(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/feedback/${id}`, { method: 'DELETE' }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: feedbackKeys.all });
    },
  });
} 
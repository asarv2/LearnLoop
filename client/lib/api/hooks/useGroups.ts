// lib/api/hooks/useGroups.ts
import type { GroupCreate, GroupUpdate } from "@/lib/repos/groupRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { groupKeys } from "../keys";

// ---------- Queries ----------
export function useGroups() {
  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: () => api<GroupCreate[]>("/api/v1/groups"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useGroup(id: string, enabled = true) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: () => api<GroupCreate>(`/api/v1/groups/${id}`),
    enabled,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

// ---------- Mutations ----------
export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GroupCreate) =>
      api<GroupCreate>("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: GroupUpdate }) =>
      api<GroupCreate>(`/api/v1/groups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/groups/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

// lib/api/hooks/useProfiles.ts
import type { ProfileCreate, ProfileUpdate } from "@/lib/repos/profileRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { profileKeys } from "../keys";

// ---------- Queries ----------
export function useProfiles() {
  return useQuery({
    queryKey: profileKeys.list(),
    queryFn: () => api<ProfileCreate[]>('/api/v1/profiles'),
    staleTime: 5 * 60_000,      // 5 minutes
  });
}

export function useProfile(id: string, enabled = true) {
  return useQuery({
    queryKey: profileKeys.detail(id),
    queryFn: () => api<ProfileCreate>(`/api/v1/profiles/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProfileCreate) =>
      api<ProfileCreate>("/api/v1/profiles", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export function useUpdateProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfileUpdate) =>
      api<ProfileCreate>(`/api/v1/profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      // Invalidate both detail and all list queries to ensure UI updates
      qc.invalidateQueries({ queryKey: profileKeys.detail(id) });
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export function useDeleteProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(`/api/v1/profiles/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

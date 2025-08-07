// lib/api/hooks/usePersonas.ts
import type { PersonaCreate, PersonaUpdate } from "@/lib/repos/personaRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { personaKeys } from "../keys";

// ---------- Queries ----------
export function usePersonas(profileId?: string) {
  // ✨ Allow optional filtering by profileId
  const url = profileId
    ? `/api/v1/personas?profile_id=${profileId}`
    : "/api/v1/personas";
  return useQuery({
    queryKey: personaKeys.list({ profileId }), // ✨ Pass profileId as filter
    queryFn: () => api<PersonaCreate[]>(url),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function usePersona(id: string, enabled = true) {
  return useQuery({
    queryKey: personaKeys.detail(id),
    queryFn: () => api<PersonaCreate>(`/api/v1/personas/${id}`),
    enabled,
  });
}

// ✨ ADD THIS NEW HOOK ✨
/**
 * Fetches the specific persona associated with a user's profile ID.
 * Assumes a user has one primary persona.
 */
export function useUserPersona(profileId?: string) {
  const { data: personas, ...rest } = usePersonas(profileId);
  return {
    data: personas?.[0], // Return the first persona found for the profile
    ...rest,
  };
}

// ---------- Mutations ----------
export function useCreatePersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PersonaCreate) =>
      api<PersonaCreate>("/api/v1/personas", {
        method: "POST",
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
        method: "PATCH",
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
    mutationFn: () => api<void>(`/api/v1/personas/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: personaKeys.all });
    },
  });
}

// lib/api/hooks/usePersonas.ts
import type { PersonaCreate, PersonaUpdate } from "@/lib/repos/personaRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { api } from "../fetcher";
import { personaKeys } from "../keys";
import { useCreateProfile } from "./useProfiles";

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
  const { data: personas, isLoading, error, ...rest } = usePersonas(profileId);
  const createProfile = useCreateProfile();
  const createPersona = useCreatePersona();

  // If no personas found and we have a profileId, create a profile and persona
  React.useEffect(() => {
    if (
      profileId &&
      !isLoading &&
      personas &&
      personas.length === 0 &&
      !createProfile.isPending &&
      !createPersona.isPending
    ) {
      const createUserProfileAndPersona = async () => {
        try {
          // Create profile first
          const profile = await createProfile.mutateAsync({
            id: profileId, // Use the user ID as the profile ID
            name: "User Profile", // Default name
          });

          // Create persona for the profile
          await createPersona.mutateAsync({
            profile_id: profile.id,
            name: "User Persona",
            description: "Default user persona",
          });
        } catch (error) {
          console.error("Failed to create profile/persona:", error);
        }
      };

      createUserProfileAndPersona();
    }
  }, [profileId, isLoading, personas, createProfile, createPersona]);

  return {
    data: personas?.[0], // Return the first persona found for the profile
    isLoading: isLoading || createProfile.isPending || createPersona.isPending,
    error: error || createProfile.error || createPersona.error,
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
      // Invalidate both detail and all list queries to ensure UI updates
      qc.invalidateQueries({ queryKey: personaKeys.detail(id) });
      qc.invalidateQueries({ queryKey: personaKeys.all });
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

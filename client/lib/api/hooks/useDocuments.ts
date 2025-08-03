// lib/api/hooks/useDocuments.ts
import type { DocumentCreate, DocumentUpdate } from "@/lib/repos/documentRepo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../fetcher";
import { documentKeys } from "../keys";

// ---------- Queries ----------
export function useDocuments() {
  return useQuery({
    queryKey: documentKeys.list(),
    queryFn: () => api<DocumentCreate[]>("/api/v1/documents"),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useDocument(id: string, enabled = true) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => api<DocumentCreate>(`/api/v1/documents/${id}`),
    enabled,
  });
}

// ---------- Mutations ----------
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DocumentCreate) =>
      api<DocumentCreate>("/api/v1/documents", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useUpdateDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: DocumentUpdate) =>
      api<DocumentCreate>(`/api/v1/documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: documentKeys.detail(id) });
    },
  });
}

export function useDeleteDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/documents/${id}`, { method: "DELETE" }),
    onSuccess() {
      // remove both list & detail caches
      qc.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}

export function useUploadDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api<{ success: boolean; key: string; message: string }>(
        `/api/v1/documents/${id}/upload`,
        {
          method: "POST",
          body: formData,
        }
      ),
    onSuccess() {
      qc.invalidateQueries({ queryKey: documentKeys.detail(id) });
    },
  });
}

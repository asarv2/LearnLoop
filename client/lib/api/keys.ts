// lib/api/keys.ts
export const assessmentKeys = {
  all: ['assessments'] as const,
  list: (filters?: unknown) => [...assessmentKeys.all, { filters }] as const,
  detail: (id: string) => [...assessmentKeys.all, id] as const,
}; 
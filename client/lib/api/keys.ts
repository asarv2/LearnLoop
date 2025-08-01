// lib/api/keys.ts
export const assessmentKeys = {
  all: ['assessments'] as const,
  list: (filters?: unknown) => [...assessmentKeys.all, { filters }] as const,
  detail: (id: string) => [...assessmentKeys.all, id] as const,
};

export const attemptKeys = {
  all: ['attempts'] as const,
  list: (filters?: unknown) => [...attemptKeys.all, { filters }] as const,
  detail: (id: string) => [...attemptKeys.all, id] as const,
};

export const chatKeys = {
  all: ['chats'] as const,
  list: (filters?: unknown) => [...chatKeys.all, { filters }] as const,
  detail: (id: string) => [...chatKeys.all, id] as const,
}; 
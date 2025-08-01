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

export const feedbackKeys = {
  all: ['feedback'] as const,
  list: (filters?: unknown) => [...feedbackKeys.all, { filters }] as const,
  detail: (id: string) => [...feedbackKeys.all, id] as const,
};

export const fieldKeys = {
  all: ['fields'] as const,
  list: (filters?: unknown) => [...fieldKeys.all, { filters }] as const,
  detail: (id: string) => [...fieldKeys.all, id] as const,
};

export const hintKeys = {
  all: ['hints'] as const,
  list: (filters?: unknown) => [...hintKeys.all, { filters }] as const,
  detail: (id: string) => [...hintKeys.all, id] as const,
};

export const messageKeys = {
  all: ['messages'] as const,
  list: (filters?: unknown) => [...messageKeys.all, { filters }] as const,
  detail: (id: string) => [...messageKeys.all, id] as const,
};

export const parameterKeys = {
  all: ['parameters'] as const,
  list: (filters?: unknown) => [...parameterKeys.all, { filters }] as const,
  detail: (id: string) => [...parameterKeys.all, id] as const,
};

export const personaKeys = {
  all: ['personas'] as const,
  list: (filters?: unknown) => [...personaKeys.all, { filters }] as const,
  detail: (id: string) => [...personaKeys.all, id] as const,
};

export const profileKeys = {
  all: ['profiles'] as const,
  list: (filters?: unknown) => [...profileKeys.all, { filters }] as const,
  detail: (id: string) => [...profileKeys.all, id] as const,
};

export const questionKeys = {
  all: ['questions'] as const,
  list: (filters?: unknown) => [...questionKeys.all, { filters }] as const,
  detail: (id: string) => [...questionKeys.all, id] as const,
};

export const scenarioKeys = {
  all: ['scenarios'] as const,
  list: (filters?: unknown) => [...scenarioKeys.all, { filters }] as const,
  detail: (id: string) => [...scenarioKeys.all, id] as const,
}; 
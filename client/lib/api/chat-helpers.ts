// lib/api/chat-helpers.ts

/**
 * Common include patterns for chat queries
 */
export const chatIncludes = {
  full: ['grades', 'assessment', 'feedback', 'hints', 'messages'] as const,
  grades: ['grades'] as const,
  assessment: ['assessment'] as const,
  feedback: ['feedback'] as const,
  hints: ['hints'] as const,
  messages: ['messages'] as const,
  gradesAndAssessment: ['grades', 'assessment'] as const,
  feedbackAndHints: ['feedback', 'hints'] as const,
} as const;

/**
 * Type for chat include patterns
 */
export type ChatIncludePattern = keyof typeof chatIncludes;

/**
 * Get include array for a chat query
 * @param pattern - The include pattern to use
 * @returns Array of include strings
 */
export function getChatIncludes(pattern: ChatIncludePattern): string[] {
  return [...chatIncludes[pattern]];
}

/**
 * Get include array for multiple patterns
 * @param patterns - Array of include patterns
 * @returns Array of include strings
 */
export function getChatIncludesMultiple(patterns: ChatIncludePattern[]): string[] {
  const includes = new Set<string>();
  patterns.forEach(pattern => {
    chatIncludes[pattern].forEach(include => includes.add(include));
  });
  return Array.from(includes);
} 
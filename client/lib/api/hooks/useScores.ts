// lib/api/hooks/useScores.ts
import type { Tables } from "@/database.types";
import { useQuery } from "@tanstack/react-query";
import { api } from "../fetcher";
import { interviewScoreKeys, offboardingScoreKeys } from "../keys";

export type InterviewScore = Tables<"interview_scores">;
export type OffboardingScore = Tables<"offboarding_scores">;

export function useInterviewScores() {
  return useQuery({
    queryKey: interviewScoreKeys.list(),
    queryFn: () => api<InterviewScore[]>("/api/v1/interview-scores"),
    staleTime: 5 * 60_000,
  });
}

export function useOffboardingScores() {
  return useQuery({
    queryKey: offboardingScoreKeys.list(),
    queryFn: () => api<OffboardingScore[]>("/api/v1/offboarding-scores"),
    staleTime: 5 * 60_000,
  });
}

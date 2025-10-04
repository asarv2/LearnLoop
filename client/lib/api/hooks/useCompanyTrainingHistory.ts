// lib/api/hooks/useCompanyTrainingHistory.ts
import type { Profile, Training } from "@/types";
import { useMemo } from "react";
import { useAttempts } from "./useAttempts";
import { useChats } from "./useChats";
import { useProfiles } from "./useProfiles";
import { useStandardAndRequiredTrainingsForCompany } from "./useTrainings";

// Types for the company training history
export interface AttemptWithDetails {
  id: string;
  training_id: string;
  profile_id: string;
  created_at: string;
  updated_at: string;
  training?: Partial<Training>;
  profile?: Partial<Profile>;
  chatInfo?: {
    title: string;
    name: string;
    isCompleted: boolean;
    completedAt?: string | null;
    totalChats: number;
    completedChats: number;
  };
  latestChatId?: string | null;
}

export function useCompanyTrainingHistory(company: string | null) {
  // Fetch all profiles to get company profiles
  const { data: allProfiles, isLoading: profilesLoading } = useProfiles();

  // Fetch all attempts
  const { data: allAttempts, isLoading: attemptsLoading } = useAttempts();

  // Fetch all chats
  const { data: allChats, isLoading: chatsLoading } = useChats();

  // Fetch standard and required trainings for the company
  const { data: companyTrainings, isLoading: trainingsLoading } =
    useStandardAndRequiredTrainingsForCompany(company);

  // Get company profile IDs
  const companyProfileIds = useMemo(() => {
    if (!allProfiles || !company) return [];
    return allProfiles
      .filter((profile) => profile.company === company)
      .map((profile) => profile.id);
  }, [allProfiles, company]);

  // Get company training IDs (standard and required only)
  const companyTrainingIds = useMemo(() => {
    if (!companyTrainings) return [];
    return companyTrainings.map((training) => training.id);
  }, [companyTrainings]);

  // Process and compile the data
  const processedData = useMemo(() => {
    if (
      !allAttempts ||
      !allChats ||
      companyProfileIds.length === 0 ||
      companyTrainingIds.length === 0
    ) {
      return [];
    }

    // Filter attempts for company profiles and standard/required trainings
    const companyAttempts = allAttempts.filter(
      (attempt) =>
        attempt.id &&
        companyProfileIds.includes(attempt.profile_id || "") &&
        companyTrainingIds.includes(attempt.training_id || "")
    );

    // Get all chats for these attempts
    const attemptIds = companyAttempts.map((attempt) => attempt.id);
    const relevantChats = allChats.filter((chat) =>
      attemptIds.includes(chat.attempt_id || "")
    );

    // Compile the data with chat information
    const attemptsWithDetails: AttemptWithDetails[] = companyAttempts.map(
      (attempt) => {
        // Get all chats for this attempt
        const attemptChats = relevantChats.filter(
          (chat) => chat.attempt_id === attempt.id
        );

        // Sort chats by creation date (newest first)
        const sortedChats = attemptChats.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        const latestChat = sortedChats[0];

        // Find training and profile details
        const training = companyTrainings?.find(
          (t) => t.id === attempt.training_id
        );
        const profile = allProfiles?.find((p) => p.id === attempt.profile_id);

        // Compile chat information
        const chatInfo =
          attemptChats.length > 0
            ? {
                title: latestChat?.title || "Untitled Interview",
                name: latestChat?.title || "Unknown Candidate",
                isCompleted: attemptChats.every((chat) => chat.completed),
                completedAt: attemptChats.every((chat) => chat.completed)
                  ? attemptChats[attemptChats.length - 1]?.completed_at
                  : undefined,
                totalChats: attemptChats.length,
                completedChats: attemptChats.filter((chat) => chat.completed)
                  .length,
              }
            : {
                title: "Untitled Interview",
                name: "Unknown Candidate",
                isCompleted: false,
                totalChats: 0,
                completedChats: 0,
              };

        return {
          id: attempt.id!,
          training_id: attempt.training_id || "",
          profile_id: attempt.profile_id || "",
          created_at: attempt.created_at || "",
          updated_at: attempt.updated_at || "",
          training,
          profile,
          chatInfo,
          latestChatId: latestChat?.id || null,
        };
      }
    );

    // Sort by creation date (newest first)
    return attemptsWithDetails.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  }, [
    allAttempts,
    allChats,
    companyProfileIds,
    companyTrainingIds,
    companyTrainings,
    allProfiles,
  ]);

  const isLoading =
    profilesLoading || attemptsLoading || chatsLoading || trainingsLoading;
  const hasError = false; // We could add error handling here if needed

  return {
    data: processedData,
    isLoading,
    error: hasError
      ? new Error("Failed to load company training history")
      : null,
  };
}

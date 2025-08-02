// types/history.ts
import type { Tables } from "@/database.types";

export type AttemptWithTraining = Tables<"attempts"> & {
  trainings: Tables<"trainings"> | null;
};

export type ChatWithAttempt = Tables<"chats"> & {
  attempts?: Tables<"attempts"> | null;
};

export type HistorySession = {
  attempt: AttemptWithTraining;
  chats: Tables<"chats">[];
  totalDuration: number;
  isCompleted: boolean;
  completedAt?: string;
  startedAt: string;
};

export type SessionStatus = "completed" | "in-progress" | "all";
export type SessionType =
  | "regular"
  | "ai-assisted"
  | "cheating"
  | "preparation"
  | "all";

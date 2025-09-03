/**
 * app/dashboard/history/page.tsx
 * Used to show the history of the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import WorkInProgressModal from "@/components/common/WorkInProgressModal";
import History from "@/components/dashboard/history/History";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "History",
  description: `History of the user on LearnLoop.`,
};

export default function HistoryPage() {
  return (
    <>
      <History />
      <WorkInProgressModal
        title="Past Sessions"
        description="The past sessions feature is currently being developed. This will allow you to review your previous training sessions, track your progress over time, and analyze your performance patterns to identify areas for improvement."
      />
    </>
  );
}

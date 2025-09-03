/**
 * app/dashboard/advice/page.tsx
 * Used to show the advice for the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import WorkInProgressModal from "@/components/common/WorkInProgressModal";
import BestPractices from "@/components/dashboard/advice/BestPractices";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advice",
  description: `Advice for the user on LearnLoop.`,
};

export default function AdvicePage() {
  return (
    <>
      <BestPractices />
      <WorkInProgressModal
        title="Best Practices"
        description="The best practices feature is currently being developed. This will provide you with expert guidance, proven strategies, and actionable tips to enhance your communication skills and improve your performance in various professional scenarios."
      />
    </>
  );
}

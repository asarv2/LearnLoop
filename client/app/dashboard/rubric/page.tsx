/**
 * app/dashboard/rubric/page.tsx
 * Used to show the rubric of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import WorkInProgressModal from "@/components/common/WorkInProgressModal";
import Evaluation from "@/components/dashboard/rubric/Evaluation";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rubric",
  description: `Rubric of the user on LearnLoop.`,
};

export default function RubricPage() {
  return (
    <>
      <Evaluation />
      <WorkInProgressModal
        title="Evaluation"
        description="The evaluation feature is currently being developed. This will provide comprehensive assessment tools, detailed scoring rubrics, and performance analytics to help you understand your strengths and areas for improvement in your training sessions."
      />
    </>
  );
}

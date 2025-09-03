/**
 * app/dashboard/overview/page.tsx
 * Used to show the overview of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import WorkInProgressModal from "@/components/common/WorkInProgressModal";
import Overview from "@/components/dashboard/overview/Overview";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overview",
  description: `Overview of the user on LearnLoop.`,
};

export default function OverviewPage() {
  return (
    <>
      <Overview />
      <WorkInProgressModal
        title="Dashboard Overview"
        description="The dashboard overview feature is currently being developed. This will provide you with comprehensive insights into your training progress, performance metrics, and key statistics to help you track your learning journey."
      />
    </>
  );
}

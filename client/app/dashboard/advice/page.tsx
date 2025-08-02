/**
 * app/dashboard/advice/page.tsx
 * Used to show the advice for the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import BestPractices from "@/components/dashboard/advice/BestPractices";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advice",
  description: `Advice for the user on LearnLoop.`,
};

export default function AdvicePage() {
  return <BestPractices />;
}
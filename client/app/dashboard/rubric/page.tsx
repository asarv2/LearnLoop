/**
 * app/dashboard/rubric/page.tsx
 * Used to show the rubric of the application.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import Evaluation from "@/components/evaluation/Evaluation";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rubric",
  description: `Rubric of the user on LearnLoop.`,
};


export default function RubricPage() {
  return <Evaluation />;
}
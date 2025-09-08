/**
 * app/dashboard/trainings/t/[trainingId]/scenarios/page.tsx
 * Used to show all scenarios for a specific training.
 * @AshokSaravanan222 & @siladie
 * 08-09-2025
 */

import TrainingScenarios from "@/components/chat/TrainingScenarios";
import { Metadata } from "next";

interface ScenariosPageProps {
  params: {
    trainingId: string;
  };
}

export const metadata: Metadata = {
  title: "Training Scenarios",
  description: "View and select scenarios for your training session.",
};

export default async function ScenariosPage({ params }: ScenariosPageProps) {
  const { trainingId } = await params;
  return <TrainingScenarios trainingId={trainingId} />;
}

/**
 * app/dashboard/trainings/t/[trainingId]/page.tsx
 * Used to show the attempt for the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import NewScenario from "@/components/chat/NewScenario";
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ scenarioId: string }> }
): Promise<Metadata> {
  // read route params
  const { scenarioId } = await params;

  return {
    title: `Create Training Scenario`,
    description: `Create training scenario for the training with id ${scenarioId}.`,
  };
}

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;

  return <NewScenario scenarioId={scenarioId} />;
}

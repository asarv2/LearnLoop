/**
 * app/dashboard/trainings/t/[trainingId]/page.tsx
 * Used to redirect to the training page.
 * @AshokSaravanan222 & @siladie
 * 08-03-2025
 */

import type { Metadata } from "next";
import TrainingEditor from "@/components/dashboard/training/TrainingEditor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trainingId: string }>;
}): Promise<Metadata> {
  // read route params
  const { trainingId } = await params;

  return {
    title: `Training Attempt`,
    description: `Training attempt for the training with id ${trainingId}.`,
  };
}

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ trainingId: string }>;
}) {
  const { trainingId } = await params;

  return <TrainingEditor trainingId={trainingId} />;
}

/**
 * app/dashboard/trainings/t/[trainingId]/a/[attemptId]/page.tsx
 * Used to show the attempt for the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import TrainingAttempt from "@/components/chat/TrainingAttempt";
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ trainingId: string; attemptId: string }> }
): Promise<Metadata> {
  // read route params
  const { trainingId, attemptId } = await params;

  return {
    title: `Training Attempt`,
    description:
      `Training attempt for the training with id ${trainingId} and attempt id ${attemptId}.`,
  };
}

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ trainingId: string; attemptId: string }>;
}) {
  const { trainingId, attemptId } = await params;

  return (
    <TrainingAttempt attemptId={attemptId} trainingId={trainingId} />
  );
}

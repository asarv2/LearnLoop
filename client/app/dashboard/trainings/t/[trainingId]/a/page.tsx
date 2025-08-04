/**
 * app/dashboard/trainings/t/[trainingId]/a/page.tsx
 * Used to show the attempt for the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

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

  return redirect(`/dashboard/trainings/t/${trainingId}`);
}

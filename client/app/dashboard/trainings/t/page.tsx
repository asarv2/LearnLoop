/**
 * app/dashboard/trainings/t/page.tsx
 * Used to redirect to the training page.
 * @AshokSaravanan222 & @siladie
 * 08-03-2025
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Trainings`,
    description: `Trainings`,
  };
}

export default async function TrainingPage() {
  return redirect(`/dashboard/trainings`);
}
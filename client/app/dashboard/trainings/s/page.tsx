/**
 * app/dashboard/trainings/t/page.tsx
 * Used to show the attempt for the user.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
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

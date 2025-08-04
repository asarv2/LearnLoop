/**
 * app/dashboard/trainings/s/page.tsx
 * Used to redirect to the training scenarios page.
 * @AshokSaravanan222 & @siladie
 * 08-03-2025
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Training Scenarios`,
    description: `Training Scenarios`,
  };
}

export default async function TrainingScenariosPage() {
  return redirect(`/dashboard/trainings/s`);
}

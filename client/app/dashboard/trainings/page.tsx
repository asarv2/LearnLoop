/**
 * app/dashboard/trainings/page.tsx
 * Used to show all of the trainings that are practice.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */

import Trainings from "@/components/dashboard/training/Trainings";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trainings",
  description: `AI Simulated trainings for the user on LearnLoop.`,
};

export default function TrainingsPage() {
  return (
    <Trainings />
  );
}
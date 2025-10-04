"use client";

import TrainingComponent from "@/components/training/TrainingComponent";

export default function AdminCreatePage() {
  return (
    <TrainingComponent
      custom={false}
      title="Create Required Training"
      showGuidelines={true}
    />
  );
}

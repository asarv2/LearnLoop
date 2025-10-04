"use client";

import { message } from "antd";
import TrainingComponent from "./TrainingComponent";

interface CustomTrainingModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  editingTraining?: {
    id: string;
    title: string;
    description?: string | null;
  } | null;
}

export default function CustomTrainingModal({
  visible,
  onCancel,
  onSuccess,
  editingTraining,
}: CustomTrainingModalProps) {
  const [messageApi] = message.useMessage();

  const handleSuccess = () => {
    messageApi.success(
      editingTraining
        ? "Custom training updated successfully!"
        : "Custom training created successfully!"
    );
    onSuccess();
  };

  return (
    <TrainingComponent
      training_id={editingTraining?.id}
      editingTraining={
        editingTraining
          ? {
              id: editingTraining.id,
              title: editingTraining.title,
              description: editingTraining.description,
              training_type: "custom",
            }
          : null
      }
      custom={true}
      asModal={true}
      visible={visible}
      onCancel={onCancel}
      onSuccess={handleSuccess}
      title={
        editingTraining ? "Edit Custom Training" : "Create Custom Training"
      }
      showGuidelines={false}
    />
  );
}

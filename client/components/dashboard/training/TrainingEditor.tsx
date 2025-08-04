/**
 * TrainingEditor.tsx
 * Used to edit the training.
 * @AshokSaravanan222 & @siladie
 * 08-03-2025
 */

export interface TrainingEditorProps {
  trainingId: string;
}

export default function TrainingEditor({ trainingId }: TrainingEditorProps) {
  return <div>TrainingEditor{trainingId}</div>;
}
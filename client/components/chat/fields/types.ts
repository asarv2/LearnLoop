import type { Tables } from "@/database.types";

export type FieldValue = {
  fieldId: string;
  value: string;
  parameterId?: string;
  file?: File; // Add file for document fields
  selectedPersonas?: string[]; // Array of selected persona parameter IDs
};

export type FieldProps = {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (value: string, parameterId?: string) => void;
};

export type CategoricalFieldProps = FieldProps & {
  selectedParameterId?: string;
};

export type DocumentFieldProps = {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (file: File | null) => void;
};

export type PersonaFieldProps = {
  field: NonNullable<Tables<"fields">>;
  onChange: (value: string, parameterId?: string) => void;
  selectedParameterId?: string;
  customPersonaName: string;
  setCustomPersonaName: (value: string) => void;
  customVoiceType: string;
  setCustomVoiceType: (value: string) => void;
};

export type FieldCardProps = {
  fieldId: string;
  index: number;
  isComplete: boolean;
  value: string;
  onChange: (value: string, parameterId?: string, file?: File) => void;
  isLast: boolean;
  selectedParameterId?: string;
  customPersonaName: string;
  setCustomPersonaName: (value: string) => void;
  customVoiceType: string;
  setCustomVoiceType: (value: string) => void;
  hideBorder?: boolean;
  hideDivider?: boolean;
};

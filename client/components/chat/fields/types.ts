import type { Tables } from "@/database.types";

export type FieldValue = {
  fieldId: string;
  value: string;
  parameterId?: string;
  file?: File; // Add file for document fields
  selectedPersonas?: string[]; // Array of selected persona parameter IDs
  groupId?: string; // For group fields, stores the group ID to create unique identifiers
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
  onChange: (value: string, parameterId?: string, file?: File) => void;
};

export type PersonaFieldProps = {
  field: NonNullable<Tables<"fields">>;
  onChange: (value: string, parameterId?: string) => void;
  selectedParameterId?: string;
  customPersonaName: string;
  setCustomPersonaName: (value: string) => void;
  customPersonaDescription: string;
  setCustomPersonaDescription: (value: string) => void;
  customVoiceType: string;
  setCustomVoiceType: (value: string) => void;
  customVoiceFile: File | null;
  setCustomVoiceFile: (file: File | null) => void;
  customVoiceUrl: string | null;
  setCustomVoiceUrl: (url: string | null) => void;
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
  customPersonaDescription: string;
  setCustomPersonaDescription: (value: string) => void;
  customVoiceType: string;
  setCustomVoiceType: (value: string) => void;
  customVoiceFile: File | null;
  setCustomVoiceFile: (file: File | null) => void;
  customVoiceUrl: string | null;
  setCustomVoiceUrl: (url: string | null) => void;
  hideBorder?: boolean;
  hideDivider?: boolean;
  customFieldName?: string;
};

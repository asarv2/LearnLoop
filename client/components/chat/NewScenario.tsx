/**
 * NewScenario.tsx
 * Used to create a new scenario for a training.
 * @AshokSaravanan222 & @siladie
 * 08-02-2025
 */
"use client";

import {
  ArrowLeftIcon,
  CheckIcon,
  FileTextIcon,
  PlayIcon,
} from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Select,
  Spinner,
  Text,
} from "@radix-ui/themes";
import Link from "next/link";
import { useEffect, useState } from "react";

// Hooks
import { useWebSocket } from "@/contexts/websocket-context";
import { useCreateAttempt } from "@/lib/api/hooks/useAttempts";
import {
  uploadDocument,
  useCreateDocument,
} from "@/lib/api/hooks/useDocuments";
import { useField } from "@/lib/api/hooks/useFields";
import {
  useCreateParameter,
  useParametersByField,
} from "@/lib/api/hooks/useParameters";
import { usePersonas } from "@/lib/api/hooks/usePersonas";
import { useScenario } from "@/lib/api/hooks/useScenarios";

// Types
import { useAuth } from "@/components/auth/AuthProvider";
import type { Tables } from "@/database.types";
import { useCreateChat } from "@/lib/api/hooks/useChats";

export interface NewScenarioProps {
  scenarioId: string;
}

type FieldValue = {
  fieldId: string;
  value: string;
  parameterId?: string;
  file?: File; // Add file for document fields
};

// Individual field components
function TextField({
  field,
  value,
  onChange,
}: {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder={field.description || `Enter ${field.name.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: "8px",
        border: `1px solid ${value ? "var(--green-7)" : "var(--gray-6)"}`,
        fontSize: "16px",
        outline: "none",
        background: "white",
      }}
    />
  );
}

function NumericalField({
  field,
  value,
  onChange,
}: {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      placeholder={field.description || `Enter ${field.name.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "12px 16px",
        borderRadius: "8px",
        border: `1px solid ${value ? "var(--green-7)" : "var(--gray-6)"}`,
        fontSize: "16px",
        outline: "none",
        background: "white",
      }}
    />
  );
}

function CategoricalField({
  field,
  value,
  onChange,
}: {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: parameters, isLoading } = useParametersByField(field.id);

  if (isLoading) return <Spinner size="2" />;

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "8px",
          border: `1px solid ${value ? "var(--green-7)" : "var(--gray-6)"}`,
          fontSize: "16px",
          background: "white",
        }}
        placeholder={`Select ${field.name.toLowerCase()}`}
      />
      <Select.Content>
        {parameters?.map((parameter) => (
          <Select.Item key={parameter.id!} value={parameter.id!}>
            {parameter.name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

function DocumentField({
  field,
  value,
  onChange,
}: {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (file: File | null) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onChange(file);
    }
  };

  const hasFile = selectedFile || value;

  return (
    <Box
      style={{
        border: `2px dashed ${hasFile ? "var(--green-7)" : "var(--gray-6)"}`,
        borderRadius: "8px",
        padding: "24px",
        textAlign: "center",
        cursor: "pointer",
        background: hasFile ? "var(--green-1)" : "var(--gray-1)",
        transition: "all 0.2s ease",
      }}
      onClick={() =>
        document.getElementById(`file-upload-${field.id}`)?.click()
      }
    >
      {hasFile ? (
        <Flex direction="column" align="center" gap="2">
          <CheckIcon width="24" height="24" color="var(--green-9)" />
          <Text size="3" weight="medium" color="green">
            {selectedFile?.name || value}
          </Text>
          <Text size="1" color="gray">
            Click to change file
          </Text>
        </Flex>
      ) : (
        <Flex direction="column" align="center" gap="2">
          <FileTextIcon width="24" height="24" color="var(--gray-9)" />
          <Text size="3" weight="medium">
            Click to upload {field.name.toLowerCase()}
          </Text>
          <Text size="1" color="gray">
            {field.description}
          </Text>
        </Flex>
      )}
      <input
        id={`file-upload-${field.id}`}
        type="file"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </Box>
  );
}

function PersonaField({
  field,
  value,
  onChange,
}: {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (value: string) => void;
}) {
  const { data: personas, isLoading } = usePersonas();

  if (isLoading) return <Spinner size="2" />;

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "8px",
          border: `1px solid ${value ? "var(--green-7)" : "var(--gray-6)"}`,
          fontSize: "16px",
          background: "white",
        }}
        placeholder={`Select ${field.name.toLowerCase()}`}
      />
      <Select.Content>
        {personas?.map((persona) => (
          <Select.Item key={persona.id!} value={persona.id!}>
            {persona.name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

export default function NewScenario({ scenarioId }: NewScenarioProps) {
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Fetch scenario data
  const { data: scenario, isLoading: scenarioLoading } =
    useScenario(scenarioId);

  // Hooks for mutations
  const createParameter = useCreateParameter();
  const createAttempt = useCreateAttempt();
  const createChat = useCreateChat();
  const createDocument = useCreateDocument();
  const { emitJoinTraining } = useWebSocket();

  // Initialize field values when scenario loads
  useEffect(() => {
    if (scenario?.field_ids) {
      setFieldValues(
        scenario.field_ids.map((fieldId) => ({
          fieldId,
          value: "",
          parameterId: undefined,
        }))
      );
    }
  }, [scenario]);

  const updateFieldValue = (
    fieldId: string,
    value: string,
    parameterId?: string,
    file?: File
  ) => {
    setFieldValues((prev) =>
      prev.map((fv) =>
        fv.fieldId === fieldId ? { ...fv, value, parameterId, file } : fv
      )
    );
  };

  const isStepComplete = (fieldId: string) => {
    const fieldValue = fieldValues.find((fv) => fv.fieldId === fieldId);
    return fieldValue?.value !== "";
  };

  const allStepsComplete =
    fieldValues.length > 0 && fieldValues.every((fv) => fv.value !== "");

  const startScenario = async () => {
    if (!allStepsComplete || !scenario) {
      alert("Please complete all fields before starting the scenario");
      return;
    }

    setIsLoading(true);

    try {
      // Create parameter records for text and numerical fields
      const parameterIds: string[] = [];
      const documentUploads: { documentId: string; file: File }[] = [];

      for (const fieldValue of fieldValues) {
        if (fieldValue.parameterId) {
          // For categorical fields, use the existing parameter ID
          parameterIds.push(fieldValue.parameterId);
        } else {
          // For text, numerical, document, and persona fields, create new parameters
          const newParam = await createParameter.mutateAsync({
            field_id: fieldValue.fieldId,
            name: fieldValue.value,
            value: fieldValue.value,
          });
          parameterIds.push(newParam.id!);

          // If this is a document field with a file, create document record
          if (fieldValue.file) {
            const newDocument = await createDocument.mutateAsync({
              content: null, // Will be populated after upload
              profile_id: user?.id || null, // Use user ID as profile ID
            });
            documentUploads.push({
              documentId: newDocument.id!,
              file: fieldValue.file,
            });
          }
        }
      }

      // Create training attempt
      const attempt = await createAttempt.mutateAsync({
        training_id: scenario.training_id || undefined,
        profile_id: user?.id || null, // Use user ID as profile ID
      });

      const chat = await createChat.mutateAsync({
        attempt_id: attempt.id,
        title: scenario.title,
        name: scenario.title, // Use title as name
        position: "Participant", // Default position
        additional_info: scenario.description || "", // Use description as additional info
        profile_id: user?.id || null, // Use user ID as profile ID
        user_id: user?.id || null, // Add user ID
        voice: "alloy",
        type: "regular", // Default to regular interview type
        parameter_ids: parameterIds,
      });

      // Upload documents if any
      for (const { documentId, file } of documentUploads) {
        const formData = new FormData();
        formData.append("file", file);
        await uploadDocument(documentId, formData);
      }

      // Emit training start event via WebSocket
      if (attempt.id && chat.id) {
        emitJoinTraining({
          attempt_id: attempt.id,
          scenario_id: scenarioId,
          chat_id: chat.id,
          profile_id: user?.id || undefined,
        });
      }
    } catch (error) {
      console.error("Error starting scenario:", error);
      alert("Failed to start scenario. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (scenarioLoading) {
    return (
      <Box style={{ minHeight: "100vh", background: "var(--gray-1)" }}>
        <Container size="4" py="8">
          <Flex justify="center" align="center" style={{ minHeight: "50vh" }}>
            <Spinner size="3" />
          </Flex>
        </Container>
      </Box>
    );
  }

  if (!scenario) {
    return (
      <Box style={{ minHeight: "100vh", background: "var(--gray-1)" }}>
        <Container size="4" py="8">
          <Text>Scenario not found</Text>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: "100vh", background: "var(--gray-1)" }}>
      {/* Header */}

      {/* Back Button */}
      <Container size="4" pt="4">
        <Link href="/dashboard/trainings">
          <Button variant="ghost" size="2" style={{ color: "black" }}>
            <ArrowLeftIcon width="16" height="16" />
            Back to Training Dashboard
          </Button>
        </Link>
      </Container>

      {/* Main Content */}
      <Container size="4" py="8">
        {/* Hero Section */}
        <Box mb="10" style={{ textAlign: "center" }}>
          <Heading size="9" weight="bold" mb="4">
            {scenario.title}
          </Heading>
          <Text size="4" color="gray">
            {scenario.description}
          </Text>
        </Box>

        {/* Dynamic Field Cards */}
        <Box maxWidth="800px" mx="auto">
          {scenario.field_ids?.map((fieldId, index) => (
            <FieldCard
              key={fieldId}
              fieldId={fieldId}
              index={index}
              isComplete={isStepComplete(fieldId)}
              value={
                fieldValues.find((fv) => fv.fieldId === fieldId)?.value || ""
              }
              onChange={(value, parameterId, file) =>
                updateFieldValue(fieldId, value, parameterId, file)
              }
              isLast={index === (scenario.field_ids?.length || 0) - 1}
            />
          ))}

          {/* Start Button */}
          <Box>
            <Card
              style={{
                background: allStepsComplete ? "white" : "var(--gray-2)",
                border: `1px solid ${
                  allStepsComplete ? "var(--blue-7)" : "var(--gray-6)"
                }`,
                borderRadius: "12px",
                boxShadow: allStepsComplete
                  ? "0 4px 12px rgba(0, 100, 200, 0.15)"
                  : "0 1px 3px rgba(0, 0, 0, 0.1)",
                transition: "all 0.2s ease",
              }}
            >
              <Box p="6">
                <Flex align="center" gap="4">
                  <Box
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: allStepsComplete
                        ? "var(--blue-9)"
                        : "var(--gray-7)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <PlayIcon color="white" width="16" height="16" />
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Flex align="center" gap="2" mb="3">
                      <Text size="4" weight="bold">
                        Start Scenario
                      </Text>
                      {allStepsComplete && (
                        <Badge size="1" variant="soft" color="blue">
                          Ready to start
                        </Badge>
                      )}
                    </Flex>

                    <Button
                      size="3"
                      onClick={startScenario}
                      disabled={!allStepsComplete || isLoading}
                      style={{
                        width: "100%",
                        background: allStepsComplete
                          ? "var(--blue-9)"
                          : "var(--gray-6)",
                        opacity: allStepsComplete ? 1 : 0.6,
                        cursor: allStepsComplete ? "pointer" : "not-allowed",
                      }}
                    >
                      {isLoading ? (
                        <Flex align="center" gap="2">
                          <Spinner size="2" />
                          <Text>Starting Scenario...</Text>
                        </Flex>
                      ) : (
                        <Flex align="center" gap="2">
                          <PlayIcon />
                          <Text>Start Scenario</Text>
                        </Flex>
                      )}
                    </Button>
                  </Box>
                </Flex>
              </Box>
            </Card>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

// Field card component
function FieldCard({
  fieldId,
  index,
  isComplete,
  value,
  onChange,
  isLast,
}: {
  fieldId: string;
  index: number;
  isComplete: boolean;
  value: string;
  onChange: (value: string, parameterId?: string, file?: File) => void;
  isLast: boolean;
}) {
  const { data: field, isLoading } = useField(fieldId);

  if (isLoading) {
    return (
      <Box mb="4">
        <Card
          style={{ background: "white", borderRadius: "12px", padding: "24px" }}
        >
          <Spinner size="2" />
        </Card>
      </Box>
    );
  }

  if (!field) return null;

  const renderFieldInput = () => {
    if (!field) return null;

    const handleChange = (newValue: string) => {
      if (field.field_type === "categorical") {
        // For categorical, the value is the parameter ID
        onChange(newValue, newValue);
      } else {
        onChange(newValue);
      }
    };

    const handleFileChange = (file: File | null) => {
      if (field.field_type === "document") {
        onChange(file?.name || "", undefined, file || undefined);
      }
    };

    const safeField = field as NonNullable<Tables<"fields">>;

    switch (field.field_type) {
      case "text":
        return (
          <TextField field={safeField} value={value} onChange={handleChange} />
        );
      case "numerical":
        return (
          <NumericalField
            field={safeField}
            value={value}
            onChange={handleChange}
          />
        );
      case "categorical":
        return (
          <CategoricalField
            field={safeField}
            value={value}
            onChange={handleChange}
          />
        );
      case "document":
        return (
          <DocumentField
            field={safeField}
            value={value}
            onChange={handleFileChange}
          />
        );
      case "persona":
        return (
          <PersonaField
            field={safeField}
            value={value}
            onChange={handleChange}
          />
        );
      default:
        return <Text>Unknown field type: {field.field_type}</Text>;
    }
  };

  return (
    <>
      <Box mb="4">
        <Card
          style={{
            background: "white",
            border: `1px solid ${
              isComplete ? "var(--green-8)" : "var(--gray-6)"
            }`,
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            transition: "all 0.2s ease",
          }}
        >
          <Box p="6">
            <Flex align="center" gap="4">
              <Box
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: isComplete ? "var(--green-9)" : "var(--gray-7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {isComplete ? (
                  <CheckIcon color="white" width="16" height="16" />
                ) : (
                  <Text size="2" weight="bold" style={{ color: "white" }}>
                    {index + 1}
                  </Text>
                )}
              </Box>
              <Box style={{ flex: 1 }}>
                <Flex align="center" gap="2" mb="3">
                  <Text size="4" weight="bold">
                    {field.name}
                  </Text>
                  {isComplete && (
                    <Badge size="1" variant="soft" color="green">
                      Complete
                    </Badge>
                  )}
                </Flex>
                {renderFieldInput()}
              </Box>
            </Flex>
          </Box>
        </Card>
      </Box>

      {/* Progress Bar */}
      {!isLast && (
        <Flex justify="center" mb="4">
          <Box
            style={{
              width: "2px",
              height: "24px",
              background: isComplete ? "var(--green-8)" : "var(--gray-6)",
              borderRadius: "2px",
            }}
          />
        </Flex>
      )}
    </>
  );
}

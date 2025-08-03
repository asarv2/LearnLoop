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
  selectedPersonas?: string[]; // Array of selected persona parameter IDs
};

// Individual field components
function TextField({
  field,
  value,
  onChange,
}: {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (value: string, parameterId?: string) => void;
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
  onChange: (value: string, parameterId?: string) => void;
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
  onChange: (value: string, parameterId?: string) => void;
}) {
  const { data: parameters, isLoading } = useParametersByField(field.id);

  if (isLoading) return <Spinner size="2" />;

  const colors = [
    "var(--green-2)",
    "var(--blue-2)",
    "var(--purple-2)",
    "var(--orange-2)",
    "var(--red-2)",
    "var(--gold-2)",
  ];

  const borderColors = [
    "var(--green-7)",
    "var(--blue-7)",
    "var(--purple-7)",
    "var(--orange-7)",
    "var(--red-7)",
    "var(--gold-7)",
  ];

  const dotColors = [
    "var(--green-9)",
    "var(--blue-9)",
    "var(--purple-9)",
    "var(--orange-9)",
    "var(--red-9)",
    "var(--gold-9)",
  ];

  return (
    <Flex direction="column" gap="3">
      {parameters?.map((parameter, index) => {
        const isSelected = value === parameter.id;
        const colorIndex = index % colors.length;

        return (
          <Card
            key={parameter.id!}
            style={{
              background: isSelected ? colors[colorIndex] : "var(--gray-1)",
              border: `2px solid ${
                isSelected ? borderColors[colorIndex] : "var(--gray-6)"
              }`,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onClick={() => onChange(parameter.id!, parameter.id!)}
          >
            <Box p="4">
              <Flex align="center" gap="3">
                <Box
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: `2px solid ${
                      isSelected ? dotColors[colorIndex] : "var(--gray-6)"
                    }`,
                    background: isSelected
                      ? dotColors[colorIndex]
                      : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && (
                    <CheckIcon width="12" height="12" color="white" />
                  )}
                </Box>
                <Box>
                  <Text size="3" weight="bold">
                    {parameter.name}:
                  </Text>
                  {parameter.description && (
                    <Text size="2" color="gray">
                      {` ${parameter.description}`}
                    </Text>
                  )}
                </Box>
              </Flex>
            </Box>
          </Card>
        );
      })}
    </Flex>
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
  onChange,
}: {
  field: NonNullable<Tables<"fields">>;
  onChange: (value: string, parameterId?: string) => void;
}) {
  const { data: parameters, isLoading } = useParametersByField(field.id);
  const [personaSelections, setPersonaSelections] = useState<string[]>([""]);

  if (isLoading) return <Spinner size="2" />;

  const handlePersonaSelect = (index: number, parameterId: string) => {
    const newSelections = [...personaSelections];
    newSelections[index] = parameterId;
    setPersonaSelections(newSelections);

    // Update parent with comma-separated parameter IDs only
    const validSelections = newSelections.filter((id) => id && id.trim());
    const selectedNames = validSelections.join(",");

    onChange(selectedNames, selectedNames);
  };

  const addPersonaSelection = () => {
    setPersonaSelections([...personaSelections, ""]);
  };

  const removePersonaSelection = (index: number) => {
    // Don't allow removal if there's only one persona left
    if (personaSelections.length <= 1) {
      return;
    }

    const newSelections = personaSelections.filter((_, i) => i !== index);
    setPersonaSelections(newSelections);

    // Update parent with comma-separated parameter IDs only
    const validSelections = newSelections.filter((id) => id && id.trim());
    const selectedNames = validSelections.join(",");

    onChange(selectedNames, selectedNames);
  };

  return (
    <Flex direction="column" gap="3">
      {/* Existing persona selections */}
      {personaSelections.map((selectedId, index) => {
        const selectedParameter = parameters?.find((p) => p.id === selectedId);
        return (
          <Card
            key={index}
            style={{
              background: "var(--gray-1)",
              border: "1px solid var(--gray-6)",
            }}
          >
            <Box p="4">
              <Flex align="center" gap="3" justify="between">
                <Text size="3" weight="medium">
                  Persona {index + 1}:
                </Text>
                <select
                  value={selectedId}
                  onChange={(e) => handlePersonaSelect(index, e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--gray-6)",
                    background: "white",
                    fontSize: "14px",
                    minWidth: "200px",
                  }}
                >
                  <option value="">Select a persona...</option>
                  {parameters?.map((parameter) => (
                    <option key={parameter.id || ""} value={parameter.id || ""}>
                      {parameter.name || "Unnamed Parameter"}
                    </option>
                  ))}
                </select>
                <Button
                  size="1"
                  variant="soft"
                  color="red"
                  onClick={() => removePersonaSelection(index)}
                  disabled={personaSelections.length <= 1}
                  style={{
                    opacity: personaSelections.length <= 1 ? 0.5 : 1,
                    cursor:
                      personaSelections.length <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Remove
                </Button>
              </Flex>
              {selectedParameter && (
                <Box mt="2">
                  <Text size="2" color="gray">
                    {selectedParameter.description ||
                      "No description available"}
                  </Text>
                </Box>
              )}
            </Box>
          </Card>
        );
      })}

      {/* Add Persona button */}
      <Button
        size="2"
        variant="soft"
        onClick={addPersonaSelection}
        style={{
          alignSelf: "flex-start",
          background: "var(--blue-2)",
          border: "1px solid var(--blue-6)",
          color: "var(--blue-9)",
        }}
      >
        + Add Persona
      </Button>
    </Flex>
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
    if (!fieldValue) return false;

    // For persona fields, check if there's at least one valid selection
    if (fieldValue.parameterId && fieldValue.parameterId.includes(",")) {
      const validSelections = fieldValue.parameterId
        .split(",")
        .filter((id) => id.trim());
      return validSelections.length > 0;
    }

    // For other fields, check if value is not empty
    return fieldValue.value !== "";
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
        // Handle multiple persona selections
        if (fieldValue.parameterId && fieldValue.parameterId.includes(",")) {
          // Multiple persona selections - split by comma and add all IDs
          const personaIds = fieldValue.parameterId
            .split(",")
            .filter((id) => id.trim());
          parameterIds.push(...personaIds);
        } else if (fieldValue.parameterId) {
          // Single parameter ID (categorical or single persona)
          parameterIds.push(fieldValue.parameterId);
        } else {
          // For text, numerical, and document fields, create new parameters
          const newParam = await createParameter.mutateAsync({
            field_id: fieldValue.fieldId,
            name: fieldValue.value,
            value: fieldValue.value,
          });
          parameterIds.push(newParam.id!);
        }

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

    const handleChange = (newValue: string, parameterId?: string) => {
      if (
        field.field_type === "categorical" ||
        field.field_type === "persona"
      ) {
        // For categorical and persona fields, pass both value and parameter ID
        onChange(newValue, parameterId);
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
        return <PersonaField field={safeField} onChange={handleChange} />;
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

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
import {
  uploadDocument,
  useCreateDocument,
} from "@/lib/api/hooks/useDocuments";
import { useField, useFields } from "@/lib/api/hooks/useFields";
import { useParametersByField } from "@/lib/api/hooks/useParameters";
import { useScenario } from "@/lib/api/hooks/useScenarios";

// Types
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/database.types";

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
  selectedParameterId,
}: {
  field: NonNullable<Tables<"fields">>;
  value: string;
  onChange: (value: string, parameterId?: string) => void;
  selectedParameterId?: string;
}) {
  const { data: parameters, isLoading } = useParametersByField(field.id);
  const [customValue, setCustomValue] = useState("");

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

  const handleParameterSelect = (
    parameterId: string,
    parameterName: string
  ) => {
    if (parameterName.toLowerCase() === "custom") {
      // For custom, set the value to indicate it's selected, but no parameter ID
      setCustomValue("");
      onChange("Custom", undefined);
    } else {
      setCustomValue("");
      onChange(parameterName, parameterId);
    }
  };

  // Handle custom input change
  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCustomValue(newValue);
    // Pass the custom value without a parameter ID to indicate it's custom
    // If there's actual content, use it; otherwise keep "Custom" to show it's selected
    onChange(newValue.trim() !== "" ? newValue : "Custom", undefined);
  };

  return (
    <Flex direction="column" gap="3">
      {parameters?.map((parameter, index) => {
        // Check if selected by parameter ID (preferred) or by parameter name/value (fallback)
        const isSelected =
          selectedParameterId === parameter.id ||
          value === parameter.id ||
          value === parameter.name ||
          (parameter.name?.toLowerCase() === "custom" &&
            (value === "Custom" ||
              (value && value.trim() !== "" && !selectedParameterId)));
        const colorIndex = index % colors.length;
        const isCustom = parameter.name?.toLowerCase() === "custom";

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
            onClick={() =>
              handleParameterSelect(parameter.id!, parameter.name!)
            }
          >
            <Box p="4">
              <Flex direction="column" gap="3">
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

                {/* Custom Input Field - shows inline when Custom is selected */}
                {isCustom && isSelected && (
                  <Box style={{ marginLeft: "44px" }}>
                    <input
                      type="text"
                      placeholder="Enter your own custom offboarding scenario to practice..."
                      value={value === "Custom" ? customValue : value}
                      onChange={handleCustomInputChange}
                      onClick={(e) => e.stopPropagation()} // Prevent card click when clicking input
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: `1px solid ${
                          (value === "Custom" ? customValue : value)
                            ? "var(--blue-7)"
                            : "var(--gray-6)"
                        }`,
                        fontSize: "16px",
                        outline: "none",
                        background: "white",
                        transition: "all 0.2s ease",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                      }}
                    />
                  </Box>
                )}
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
            Click to upload {field.name.toLowerCase()} (Optional)
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
  selectedParameterId,
}: {
  field: NonNullable<Tables<"fields">>;
  onChange: (value: string, parameterId?: string) => void;
  selectedParameterId?: string;
}) {
  const { data: parameters, isLoading } = useParametersByField(field.id);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");

  // Sync internal state with parent when selectedParameterId changes
  useEffect(() => {
    if (selectedParameterId && selectedParameterId !== selectedPersonaId) {
      setSelectedPersonaId(selectedParameterId);
    }
  }, [selectedParameterId, selectedPersonaId]);

  if (isLoading) return <Spinner size="2" />;

  const handlePersonaSelect = (parameterId: string) => {
    setSelectedPersonaId(parameterId);
    onChange(parameterId, parameterId);
  };

  return (
    <Flex direction="column" gap="3">
      <Select value={selectedPersonaId} onValueChange={handlePersonaSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a candidate personality..." />
        </SelectTrigger>
        <SelectContent>
          {parameters?.map((parameter) => (
            <SelectItem key={parameter.id || ""} value={parameter.id || ""}>
              {parameter.name || "Unnamed Parameter"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedPersonaId && (
        <Box
          mt="2"
          p="3"
          style={{
            background: "var(--gray-2)",
            borderRadius: "8px",
            border: "1px solid var(--gray-5)",
          }}
        >
          <Text size="2" color="gray">
            {parameters?.find((p) => p.id === selectedPersonaId)?.description ||
              "No description available"}
          </Text>
        </Box>
      )}
    </Flex>
  );
}

export default function NewScenario({ scenarioId }: NewScenarioProps) {
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({
    visible: false,
    steps: [
      { label: "Processing inputs", complete: false },
      { label: "Preparing model", complete: false },
      { label: "Creating scenario", complete: false },
    ],
  });
  const { user } = useAuth();
  const { data: fields } = useFields();
  // Fetch scenario data
  const { data: scenario, isLoading: scenarioLoading } =
    useScenario(scenarioId);

  // Hooks for mutations
  const { emitStartTraining } = useWebSocket();

  // Initialize field values when scenario loads
  useEffect(() => {
    if (scenario?.field_ids) {
      // Filter out document fields for Employee Offboarding Training
      const filteredFieldIds = scenario.field_ids.filter((fieldId) => {
        const field = fields?.find((f) => f.id === fieldId);
        // If this is Employee Offboarding Training, exclude document fields
        if (scenario.title?.toLowerCase().includes("employee offboarding")) {
          return field?.field_type !== "document";
        }
        return true; // Keep all fields for other trainings
      });

      setFieldValues(
        filteredFieldIds.map((fieldId) => ({
          fieldId,
          value: "",
          parameterId: undefined,
        }))
      );
    }
  }, [scenario, fields]);

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      // Cleanup any pending timers when component unmounts
      setProgress((prev) => ({ ...prev, visible: false }));
    };
  }, []);

  // Listen for training started event to complete progress bar
  useEffect(() => {
    const handleTrainingStarted = (event: CustomEvent) => {
      if (event.detail.success) {
        // Complete the "Creating scenario" step
        setProgress((prev) => ({
          ...prev,
          steps: prev.steps.map((s, i) =>
            i === 2 ? { ...s, complete: true } : s
          ),
        }));
      }
    };

    window.addEventListener(
      "trainingStarted",
      handleTrainingStarted as EventListener
    );

    return () => {
      window.removeEventListener(
        "trainingStarted",
        handleTrainingStarted as EventListener
      );
    };
  }, []);

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

  const handleAutoFill = () => {
    // Auto-fill mapping based on field names and database values
    const autoFillMappings = [
      {
        fieldName: "Offboarding Scenario",
        value: "Involuntary Termination",
        parameterId: "bb58fdaf-0846-4951-8d16-4e17ec029ed3",
      },
      {
        fieldName: "Employee Name",
        value: "John Doe",
      },
      {
        fieldName: "Employee Role",
        value: "Software Engineer",
      },
      {
        fieldName: "Employee Level",
        value: "Junior",
        parameterId: "c4edcb88-2197-4d41-9e15-00c25713e034",
      },
      {
        fieldName: "Employee Persona",
        value: "Defensive Employee",
        parameterId: "fbc90488-613e-4692-934d-9d791558d226",
      },
    ];

    // Apply auto-fill values to matching fields
    setFieldValues((prev) =>
      prev.map((fv) => {
        const field = fields?.find((f) => f.id === fv.fieldId);
        const autoFill = autoFillMappings.find(
          (mapping) => mapping.fieldName === field?.name
        );

        if (autoFill) {
          return {
            ...fv,
            value: autoFill.value,
            parameterId: autoFill.parameterId,
          };
        }
        return fv;
      })
    );
  };

  const isStepComplete = (fieldId: string) => {
    const fieldValue = fieldValues.find((fv) => fv.fieldId === fieldId);
    if (!fieldValue) return false;

    // For persona fields, check if there's a valid selection
    if (fieldValue.parameterId) {
      return fieldValue.parameterId.trim() !== "";
    }

    // For custom fields, check if the value is not just "Custom" but has actual content
    if (fieldValue.value === "Custom") {
      return false; // Custom is selected but no actual custom text entered
    }

    // For other fields, check if value is not empty
    return fieldValue.value !== "";
  };

  const allStepsComplete =
    fieldValues.length > 0 &&
    fieldValues.every((fv) => {
      // Get the field to check its type
      const field = fields?.find((f) => f.id === fv.fieldId);

      // Document fields are always optional
      if (field?.field_type === "document") {
        return true;
      }

      if (fv.parameterId) {
        return fv.parameterId.trim() !== "";
      }

      // For custom fields, check if the value is not just "Custom" but has actual content
      if (fv.value === "Custom") {
        return false; // Custom is selected but no actual custom text entered
      }

      return fv.value !== "";
    });

  const createDocument = useCreateDocument();

  const startScenario = async () => {
    if (!allStepsComplete || !scenario) {
      alert("Please complete all fields before starting the scenario");
      return;
    }

    setIsLoading(true);
    setProgress((prev) => ({
      ...prev,
      visible: true,
      steps: prev.steps.map((s, i) => ({
        ...s,
        complete: i === 0 ? true : false,
      })),
    }));

    // Delay the "Preparing model" checkmark by 2 seconds
    const preparingModelTimer = setTimeout(() => {
      setProgress((prev) => ({
        ...prev,
        steps: prev.steps.map((s, i) =>
          i === 1 ? { ...s, complete: true } : s
        ),
      }));
    }, 2000);

    try {
      // Process field values and handle document uploads
      const processedFieldValues = await Promise.all(
        fieldValues.map(async (fieldValue) => {
          // If this is a document field with a file, upload it first
          if (fieldValue.file) {
            try {
              // Create document record
              const document = await createDocument.mutateAsync({
                content: "", // will be populated when uploading the file
                profile_id: user?.id || null,
              });

              // Upload the file
              const formData = new FormData();
              formData.append("file", fieldValue.file);
              await uploadDocument(document.id!, formData);

              // Treat as part of preparing inputs; keep UI generic

              // Return field value with document ID as the value
              return {
                ...fieldValue,
                value: document.id!, // Use document ID as the value
                file: undefined, // Remove file reference
              };
            } catch (error) {
              console.error("Error processing document:", error);
              throw new Error(`Failed to process document: ${error}`);
            }
          }

          // For non-document fields, return as is
          return fieldValue;
        })
      );

      // (preparing model will complete via timer above)

      // Emit start training event via WebSocket with processed field values
      emitStartTraining({
        scenario_id: scenarioId,
        field_values: processedFieldValues,
        profile_id: user?.id || undefined,
      });

      // Note: "Creating scenario" will complete when WebSocket responds
      // The progress will be handled in the WebSocket context
    } catch (error) {
      console.error("Error starting scenario:", error);
      alert("Failed to start scenario. Please try again.");
      setIsLoading(false);
      setProgress((prev) => ({ ...prev, visible: false }));
      // Cleanup timers on error
      if (preparingModelTimer) clearTimeout(preparingModelTimer);
    }
  };

  if (scenarioLoading) {
    return (
      <Box style={{ minHeight: "100vh", background: "transparent" }}>
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
      <Box style={{ minHeight: "100vh", background: "transparent" }}>
        <Container size="4" py="8">
          <Text>Scenario not found</Text>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: "100vh", background: "transparent" }}>
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
          {/* Title with Auto-Fill Button */}
          <Box style={{ position: "relative", marginBottom: "16px" }}>
            <Heading size="9" weight="bold">
              {scenario.title}
            </Heading>
            {/* Auto-Fill Button */}
            <Box
              style={{
                position: "absolute",
                top: "50%",
                right: "0",
                transform: "translateY(-50%)",
              }}
            >
              <Button
                variant="solid"
                size="3"
                onClick={handleAutoFill}
                style={{
                  backgroundColor: "var(--violet-9)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: "600",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--violet-10)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0, 0, 0, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--violet-9)";
                  e.currentTarget.style.transform = "translateY(0px)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(0, 0, 0, 0.15)";
                }}
              >
                Auto-Fill
              </Button>
            </Box>
          </Box>
          <Text size="4" color="gray">
            {scenario.description}
          </Text>
        </Box>

        {/* Dynamic Field Cards */}
        <Box maxWidth="800px" mx="auto">
          {fieldValues.map((fieldValue, index) => (
            <FieldCard
              key={fieldValue.fieldId}
              fieldId={fieldValue.fieldId}
              index={index}
              isComplete={isStepComplete(fieldValue.fieldId)}
              value={fieldValue.value}
              onChange={(value, parameterId, file) =>
                updateFieldValue(fieldValue.fieldId, value, parameterId, file)
              }
              isLast={index === fieldValues.length - 1}
              selectedParameterId={fieldValue.parameterId}
            />
          ))}

          {/* Progress Bar between last field and Start Scenario */}
          {fieldValues.length > 0 && (
            <Flex justify="center" mb="4">
              <Box
                style={{
                  width: "2px",
                  height: "24px",
                  background: "var(--gray-6)",
                  borderRadius: "2px",
                }}
              />
            </Flex>
          )}

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

                    {isLoading && progress.visible && (
                      <Box mt="4">
                        {/* Progress bar */}
                        <Box
                          style={{
                            width: "100%",
                            height: "8px",
                            background: "var(--gray-4)",
                            borderRadius: "999px",
                            overflow: "hidden",
                            marginBottom: "8px",
                          }}
                        >
                          {(() => {
                            const completed = progress.steps.filter(
                              (s) => s.complete
                            ).length;
                            const percent = Math.round(
                              (completed / progress.steps.length) * 100
                            );
                            return (
                              <Box
                                style={{
                                  width: `${percent}%`,
                                  height: "100%",
                                  background: "var(--blue-9)",
                                  transition: "width 300ms ease",
                                }}
                              />
                            );
                          })()}
                        </Box>
                        {/* Checklist */}
                        <Flex direction="column" gap="2">
                          {progress.steps.map((step, idx) => (
                            <Flex key={idx} align="center" gap="3">
                              <Box
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "50%",
                                  border: `2px solid ${
                                    step.complete
                                      ? "var(--green-9)"
                                      : "var(--gray-7)"
                                  }`,
                                  background: step.complete
                                    ? "var(--green-9)"
                                    : "transparent",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {step.complete ? (
                                  <CheckIcon
                                    width="10"
                                    height="10"
                                    color="white"
                                  />
                                ) : (
                                  <Spinner size="1" />
                                )}
                              </Box>
                              <Text
                                size="3"
                                style={{ opacity: step.complete ? 0.8 : 1 }}
                              >
                                {step.label}
                              </Text>
                            </Flex>
                          ))}
                        </Flex>
                      </Box>
                    )}
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
  selectedParameterId,
}: {
  fieldId: string;
  index: number;
  isComplete: boolean;
  value: string;
  onChange: (value: string, parameterId?: string, file?: File) => void;
  isLast: boolean;
  selectedParameterId?: string;
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
            selectedParameterId={selectedParameterId}
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
            onChange={handleChange}
            selectedParameterId={selectedParameterId}
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

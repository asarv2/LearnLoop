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
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Hooks
import { useWebSocket } from "@/contexts/websocket-context";
import {
  uploadDocument,
  useCreateDocument,
} from "@/lib/api/hooks/useDocuments";
import { useField, useFields } from "@/lib/api/hooks/useFields";
import {
  useCreateParameter,
  useParameters,
  useParametersByField,
} from "@/lib/api/hooks/useParameters";
import { useScenario } from "@/lib/api/hooks/useScenarios";
import { useTraining } from "@/lib/api/hooks/useTrainings";

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
  const { data: parameters, isLoading } = useParametersByField(field.id);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const suggestionItems = (() => {
    const itemsMap = new Map<string, string>();
    (parameters || []).forEach((p) => {
      const val = (p.value || "").trim();
      if (!val) return;
      const prevUpdatedAt = itemsMap.get(val) || "";
      const updatedAt = p.updated_at || "";
      if (!prevUpdatedAt || updatedAt.localeCompare(prevUpdatedAt) > 0) {
        itemsMap.set(val, updatedAt);
      }
    });
    let items = Array.from(itemsMap.entries()).map(([label, updatedAt]) => ({
      label,
      updatedAt,
    }));
    const q = (value || "").toLowerCase().trim();
    if (q) {
      items = items.filter((i) => i.label.toLowerCase().includes(q));
    }
    items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return items.slice(0, 8);
  })();

  const showSuggestions = isFocused && !isLoading && suggestionItems.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => {
        const next = prev + 1;
        return next >= suggestionItems.length ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? suggestionItems.length - 1 : next;
      });
    } else if (e.key === "Enter") {
      if (highlightIndex >= 0 && highlightIndex < suggestionItems.length) {
        e.preventDefault();
        const choice = suggestionItems[highlightIndex];
        onChange(choice.label);
        setIsFocused(false);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
    }
  };

  // Track anchor rect while open
  useEffect(() => {
    if (showSuggestions && anchorRef.current) {
      const updateRect = () => {
        if (!anchorRef.current) return;
        setAnchorRect(anchorRef.current.getBoundingClientRect());
      };
      updateRect();
      window.addEventListener("scroll", updateRect, true);
      window.addEventListener("resize", updateRect);
      return () => {
        window.removeEventListener("scroll", updateRect, true);
        window.removeEventListener("resize", updateRect);
      };
    }
    return;
  }, [showSuggestions]);

  return (
    <div ref={anchorRef} style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={field.description || `Enter ${field.name.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setIsFocused(false), 120);
        }}
        onKeyDown={handleKeyDown}
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

      {showSuggestions &&
        anchorRect &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: anchorRect.bottom + 6,
              left: anchorRect.left,
              width: anchorRect.width,
              background: "white",
              border: "1px solid var(--gray-6)",
              borderRadius: "8px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
              zIndex: 10000,
              maxHeight: "260px",
              overflowY: "auto",
            }}
          >
            {suggestionItems.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(item.label);
                  setIsFocused(false);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background:
                    highlightIndex === idx ? "var(--blue-2)" : "transparent",
                }}
              >
                <Text size="2">{item.label}</Text>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
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
  const [isCustomFocused, setIsCustomFocused] = useState(false);
  const [customHighlightIndex, setCustomHighlightIndex] = useState<number>(-1);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

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

  const handleParameterSelect = (parameterId: string) => {
    const p = parameters?.find((pp) => pp.id === parameterId);
    if (p && p.value === null) {
      // Select sentinel "Custom" and focus the custom input
      setCustomValue("");
      onChange("Custom", undefined);
    } else {
      setCustomValue("");
      onChange(p?.name || "", parameterId);
    }
  };

  // Hide custom-created parameters from the main options list
  const displayedParameters = parameters?.filter(
    (p) => (p.description || "").toLowerCase() !== "custom scenario"
  );

  // Suggestions for custom entries (only parameters with description "Custom Scenario")
  const customSuggestions = (() => {
    const itemsMap = new Map<string, { id: string; updatedAt: string }>();
    (parameters || [])
      .filter((p) => (p.description || "").toLowerCase() === "custom scenario")
      .forEach((p) => {
        const label = (p.name || "").trim();
        if (!label || !p.id) return;
        const prev = itemsMap.get(label)?.updatedAt || "";
        const ts = p.updated_at || "";
        if (!prev || ts.localeCompare(prev) > 0)
          itemsMap.set(label, { id: p.id, updatedAt: ts });
      });
    let items = Array.from(itemsMap.entries()).map(([label, meta]) => ({
      label,
      id: meta.id,
      updatedAt: meta.updatedAt,
    }));
    const q = (value === "Custom" ? customValue : value).toLowerCase().trim();
    if (q) items = items.filter((i) => i.label.toLowerCase().includes(q));
    items.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return items.slice(0, 8);
  })();

  const showCustomSuggestions = isCustomFocused && customSuggestions.length > 0;

  // Handle custom input change
  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCustomValue(newValue);
    // Pass the custom value without a parameter ID to indicate it's custom
    onChange(newValue.trim() !== "" ? newValue : "Custom", undefined);
  };

  // Track anchor rect while suggestions are open to position portal correctly
  useEffect(() => {
    if (showCustomSuggestions && anchorRef.current) {
      const updateRect = () => {
        if (!anchorRef.current) return;
        setAnchorRect(anchorRef.current.getBoundingClientRect());
      };
      updateRect();
      window.addEventListener("scroll", updateRect, true);
      window.addEventListener("resize", updateRect);
      return () => {
        window.removeEventListener("scroll", updateRect, true);
        window.removeEventListener("resize", updateRect);
      };
    }
    return;
  }, [showCustomSuggestions]);

  if (isLoading) return <Spinner size="2" />;

  return (
    <Flex direction="column" gap="3">
      {displayedParameters
        ?.sort((a, b) => a.updated_at?.localeCompare(b.updated_at || "") || 0)
        .map((parameter, index) => {
          // Custom sentinel is determined by value === null
          const isCustom = parameter.value === null;
          const isSelected =
            selectedParameterId === parameter.id ||
            value === parameter.id ||
            value === parameter.name ||
            (isCustom &&
              (value === "Custom" ||
                (value && value.trim() !== "" && !selectedParameterId)));
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
              onClick={() => handleParameterSelect(parameter.id!)}
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
                    <Box
                      style={{ marginLeft: "44px", position: "relative" }}
                      ref={anchorRef}
                    >
                      <input
                        type="text"
                        placeholder="Enter your own custom scenario to practice..."
                        value={value === "Custom" ? customValue : value}
                        onChange={handleCustomInputChange}
                        onFocus={() => setIsCustomFocused(true)}
                        onBlur={() =>
                          setTimeout(() => setIsCustomFocused(false), 120)
                        }
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            const text =
                              value === "Custom" ? customValue : value;
                            const trimmed = text.trim();
                            if (trimmed) {
                              onChange(trimmed, undefined);
                            }
                            setIsCustomFocused(false);
                          } else if (e.key === "Escape") {
                            setIsCustomFocused(false);
                          } else if (
                            e.key === "ArrowDown" &&
                            showCustomSuggestions
                          ) {
                            e.preventDefault();
                            setCustomHighlightIndex((prev) => {
                              const next = prev + 1;
                              return next >= customSuggestions.length
                                ? 0
                                : next;
                            });
                          } else if (
                            e.key === "ArrowUp" &&
                            showCustomSuggestions
                          ) {
                            e.preventDefault();
                            setCustomHighlightIndex((prev) => {
                              const next = prev - 1;
                              return next < 0
                                ? customSuggestions.length - 1
                                : next;
                            });
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
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

                      {showCustomSuggestions &&
                        anchorRect &&
                        createPortal(
                          <div
                            style={{
                              position: "fixed",
                              top: anchorRect.bottom + 6,
                              left: anchorRect.left,
                              width: anchorRect.width,
                              background: "white",
                              border: "1px solid var(--gray-6)",
                              borderRadius: "8px",
                              boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
                              zIndex: 10000,
                              maxHeight: "260px",
                              overflowY: "auto",
                            }}
                          >
                            {customSuggestions.map((item, idx) => (
                              <div
                                key={`${item.label}-${idx}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setCustomValue(item.label);
                                  // Selecting a saved custom should select the Custom option and add description
                                  onChange(item.label, undefined);
                                  setIsCustomFocused(false);
                                }}
                                onMouseEnter={() =>
                                  setCustomHighlightIndex(idx)
                                }
                                style={{
                                  padding: "10px 12px",
                                  cursor: "pointer",
                                  background:
                                    customHighlightIndex === idx
                                      ? "var(--blue-2)"
                                      : "transparent",
                                }}
                              >
                                <Text size="2">{item.label}</Text>
                              </div>
                            ))}
                          </div>,
                          document.body
                        )}
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
        accept=".pdf"
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
  const { data: allParameters } = useParameters();
  const { data: training } = useTraining(
    scenario?.training_id || "",
    Boolean(scenario?.training_id)
  );

  // Hooks for mutations
  const { emitStartTraining } = useWebSocket();

  // Initialize field values when scenario and training load
  useEffect(() => {
    if (scenario?.field_ids && fields) {
      const filteredFieldIds = scenario.field_ids.filter((fieldId) => {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) return false;
        if (field.field_type === "document") {
          return training?.show_documents === true;
        }
        return true;
      });

      setFieldValues(
        filteredFieldIds.map((fieldId) => ({
          fieldId,
          value: "",
          parameterId: undefined,
        }))
      );
    }
  }, [scenario, fields, training]);

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
    const pickRandom = <T,>(arr: T[]): T | undefined =>
      arr[Math.floor(Math.random() * arr.length)];

    setFieldValues((prev) =>
      prev.map((fv) => {
        const field = fields?.find((f) => f.id === fv.fieldId);
        if (!field) return fv;

        const paramsForField = (allParameters || []).filter(
          (p) => p.field_id === field.id
        );

        if (field.field_type === "text") {
          const candidates = paramsForField.filter(
            (p) => (p.value || "").trim() !== ""
          );
          if (candidates.length > 0) {
            const choice = pickRandom(candidates)!;
            return { ...fv, value: choice.value || "", parameterId: choice.id };
          }
          return fv;
        }

        if (field.field_type === "categorical") {
          const customCandidates = paramsForField.filter(
            (p) => (p.description || "").toLowerCase() === "custom scenario"
          );
          const normalCandidates = paramsForField.filter(
            (p) =>
              p.value !== null &&
              (p.description || "").toLowerCase() !== "custom scenario"
          );
          // If both custom and normal candidates exist, randomly pick from all
          if (customCandidates.length > 0 && normalCandidates.length > 0) {
            // Combine both, but for custom, parameterId is undefined
            const allCandidates = [
              ...normalCandidates.map((p) => ({
                value: p.name || "",
                parameterId: p.id,
              })),
              ...customCandidates.map((p) => ({
                value: p.name || "",
                parameterId: undefined,
              })),
            ];
            const choice = pickRandom(allCandidates)!;
            return {
              ...fv,
              value: choice.value,
              parameterId: choice.parameterId,
            };
          }
          // If only custom candidates exist
          if (customCandidates.length > 0) {
            const choice = pickRandom(customCandidates)!;
            return { ...fv, value: choice.name || "", parameterId: undefined };
          }
          // If only normal candidates exist
          if (normalCandidates.length > 0) {
            const choice = pickRandom(normalCandidates)!;
            return { ...fv, value: choice.name || "", parameterId: choice.id };
          }
          return fv;
        }

        if (field.field_type === "persona") {
          const candidates = paramsForField;
          if (candidates.length > 0) {
            const choice = pickRandom(candidates)!;
            return { ...fv, value: choice.name || "", parameterId: choice.id };
          }
          return fv;
        }

        // Skip document and numerical by default
        if (field.field_type === "numerical") {
          const candidates = paramsForField.filter(
            (p) => (p.value || "").trim() !== ""
          );
          if (candidates.length > 0) {
            const choice = pickRandom(candidates)!;
            return { ...fv, value: choice.value || "" };
          }
          return fv;
        }

        return fv;
      })
    );
  };

  const isStepComplete = (fieldId: string) => {
    const fieldValue = fieldValues.find((fv) => fv.fieldId === fieldId);
    if (!fieldValue) return false;

    const field = fields?.find((f) => f.id === fieldId);
    if (!field) return false;

    if (field.field_type === "persona") {
      return Boolean(
        fieldValue.parameterId && fieldValue.parameterId.trim() !== ""
      );
    }

    if (field.field_type === "categorical") {
      // Complete if a parameter is chosen OR user typed a non-empty custom value
      if (fieldValue.parameterId && fieldValue.parameterId.trim() !== "")
        return true;
      const hasTypedCustom =
        fieldValue.value.trim() !== "" && fieldValue.value !== "Custom";
      return hasTypedCustom;
    }

    if (fieldValue.value === "Custom") {
      return false;
    }

    if (field.field_type === "document") {
      return true;
    }

    return fieldValue.value.trim() !== "";
  };

  const allStepsComplete =
    fieldValues.length > 0 &&
    fieldValues.every((fv) => {
      const field = fields?.find((f) => f.id === fv.fieldId);
      if (!field) return false;
      if (field.hidden) return true; // hidden fields do not gate UI completion
      if (field.field_type === "document") return true;
      return isStepComplete(fv.fieldId);
    });

  const createDocument = useCreateDocument();
  const createParameterGlobal = useCreateParameter();

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
      const processedFieldValuesUpload = await Promise.all(
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

      // Map text/custom values to existing parameter IDs to avoid duplicates
      const processedFieldValues = await Promise.all(
        processedFieldValuesUpload.map(async (fv) => {
          const field = fields?.find((f) => f.id === fv.fieldId);
          if (!field) return fv;

          if (field.field_type === "text" && fv.value) {
            const existing = (allParameters || []).find(
              (p) => p.field_id === field.id && (p.value || "") === fv.value
            );
            if (existing) {
              return { ...fv, parameterId: existing.id };
            }
          }

          if (
            field.field_type === "categorical" &&
            !fv.parameterId &&
            fv.value
          ) {
            const existingCustom = (allParameters || []).find(
              (p) =>
                p.field_id === field.id &&
                (p.description || "").toLowerCase() === "custom scenario" &&
                (p.name || "") === fv.value
            );
            if (existingCustom) {
              return { ...fv, parameterId: existingCustom.id };
            }
            // Create custom parameter on start if it doesn't exist yet
            try {
              const created = await createParameterGlobal.mutateAsync({
                field_id: field.id,
                name: fv.value,
                description: "Custom Scenario",
                value: fv.value
                  .normalize("NFKD")
                  .replace(/[^\p{L}\p{N}]+/gu, " ")
                  .trim()
                  .replace(/\s+/g, "_")
                  .toLowerCase(),
              });
              if (created?.id) {
                return { ...fv, parameterId: created.id };
              }
            } catch (e) {
              console.error(
                "Failed to create custom parameter during start",
                e
              );
            }
          }

          return fv;
        })
      );

      // (preparing model will complete via timer above)

      // Ensure hidden fields have a randomized value if not already set
      const finalFieldValues = processedFieldValues.map((fv) => {
        const field = fields?.find((f) => f.id === fv.fieldId);
        if (!field || !field.hidden) return fv;

        const paramsForField = (allParameters || []).filter(
          (p) => p.field_id === field.id
        );

        const pickRandom = <T,>(arr: T[]): T | undefined =>
          arr[Math.floor(Math.random() * arr.length)];

        // If already provided, keep existing
        if (
          (fv.parameterId && fv.parameterId.trim() !== "") ||
          (fv.value && fv.value.trim() !== "" && fv.value !== "Custom")
        ) {
          return fv;
        }

        switch (field.field_type) {
          case "text": {
            const candidates = paramsForField.filter(
              (p) => (p.value || "").trim() !== ""
            );
            const choice = pickRandom(candidates);
            if (choice) {
              return {
                ...fv,
                value: choice.value || "",
                parameterId: choice.id,
              };
            }
            return fv;
          }
          case "numerical": {
            const candidates = paramsForField.filter(
              (p) => (p.value || "").trim() !== ""
            );
            const choice = pickRandom(candidates);
            if (choice) {
              return { ...fv, value: choice.value || "" };
            }
            return fv;
          }
          case "categorical": {
            const customCandidates = paramsForField.filter(
              (p) => (p.description || "").toLowerCase() === "custom scenario"
            );
            const normalCandidates = paramsForField.filter(
              (p) =>
                p.value !== null &&
                (p.description || "").toLowerCase() !== "custom scenario"
            );
            const allChoices = [
              ...normalCandidates.map((p) => ({
                value: p.name || "",
                parameterId: p.id,
              })),
              ...customCandidates.map((p) => ({
                value: p.name || "",
                parameterId: undefined as string | undefined,
              })),
            ];
            const choice = pickRandom(allChoices);
            if (choice) {
              return {
                ...fv,
                value: choice.value,
                parameterId: choice.parameterId,
              };
            }
            return fv;
          }
          case "persona": {
            const choice = pickRandom(paramsForField);
            if (choice) {
              return {
                ...fv,
                value: choice.name || "",
                parameterId: choice.id,
              };
            }
            return fv;
          }
          default:
            return fv;
        }
      });

      // Emit start training event via WebSocket with processed field values
      emitStartTraining({
        scenario_id: scenarioId,
        field_values: finalFieldValues,
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
        <Box maxWidth="800px" mx="auto" mt="4">
          {fieldValues
            .filter((fv) => {
              const field = fields?.find((f) => f.id === fv.fieldId);
              // Do not render hidden fields in the UI
              return field ? !field.hidden : true;
            })
            .map((fieldValue, index, visibleArray) => (
              <FieldCard
                key={fieldValue.fieldId}
                fieldId={fieldValue.fieldId}
                index={index}
                isComplete={isStepComplete(fieldValue.fieldId)}
                value={fieldValue.value}
                onChange={(value, parameterId, file) =>
                  updateFieldValue(fieldValue.fieldId, value, parameterId, file)
                }
                isLast={index === visibleArray.length - 1}
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
            position: "relative",
            overflow: "visible",
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

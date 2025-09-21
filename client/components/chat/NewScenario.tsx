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
import { useFields } from "@/lib/api/hooks/useFields";
import { useGroups } from "@/lib/api/hooks/useGroups";
import {
  useCreateParameter,
  useParameters,
} from "@/lib/api/hooks/useParameters";
import { useCreatePersona, usePersonas } from "@/lib/api/hooks/usePersonas";
import { useScenario } from "@/lib/api/hooks/useScenarios";
import { useTraining } from "@/lib/api/hooks/useTrainings";

// Types
import { useAuth } from "@/components/auth/AuthProvider";
import DocumentPreviewCard from "./DocumentPreviewCard";
import DocumentViewerModal from "./DocumentViewerModal";
import { FieldCard, type FieldValue } from "./fields";

export interface NewScenarioProps {
  scenarioId: string;
}

export default function NewScenario({ scenarioId }: NewScenarioProps) {
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [groupFieldValues, setGroupFieldValues] = useState<FieldValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({
    visible: false,
    steps: [
      { label: "Processing inputs", complete: false },
      { label: "Generating scenario", complete: false },
      { label: "Creating objectives", complete: false },
      { label: "Creating persona prompts", complete: false },
      { label: "Generating documents", complete: false },
    ],
    completedCount: 0,
    totalTools: 0,
  });
  const preparingModelTimerRef = useRef<number | null>(null);
  const { user } = useAuth();
  const { data: fields } = useFields();
  const { data: groups } = useGroups();
  // Fetch scenario data
  const { data: scenario, isLoading: scenarioLoading } =
    useScenario(scenarioId);
  const { data: allParameters } = useParameters();
  const { data: training } = useTraining(
    scenario?.training_id || "",
    Boolean(scenario?.training_id)
  );
  const { data: personas } = usePersonas();
  const createPersona = useCreatePersona();

  // Hooks for mutations
  const {
    emitStartTraining,
    emitGenerateScenario,
    emitUpdateScenarioParameters,
  } = useWebSocket();

  // Scenario generation draft state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [draftProblem, setDraftProblem] = useState<string>("");
  const [draftObjectives, setDraftObjectives] = useState<string[]>([]);
  const [draftDocumentIds, setDraftDocumentIds] = useState<string[]>([]);
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(null);

  // Custom persona state for global access
  const [customPersonalityType, setCustomPersonalityType] =
    useState<string>("");
  const [customPersonaName, setCustomPersonaName] = useState<string>("");
  const [customVoiceType, setCustomVoiceType] = useState<string>("");
  const [customAssistantPersonaId, setCustomAssistantPersonaId] = useState<
    string | null
  >(null);

  // Track the parameters used in the last generation to detect changes
  const [lastGeneratedSignature, setLastGeneratedSignature] = useState<
    string | null
  >(null);

  // Document viewer modal state
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    name?: string;
  } | null>(null);

  // Create a stable signature string from payload values for comparison
  const makeSignatureFromPayload = (
    items: { fieldId: string; value: string; parameterId?: string }[]
  ): string => {
    const parts = items
      .map((i) => `${i.fieldId}:${i.parameterId || ""}:${i.value || ""}`)
      .sort();
    return parts.join("|");
  };

  // Create personas from group field values and return payload with persona IDs
  const createPersonasFromGroupsAndGetPayload = async (): Promise<
    {
      fieldId: string;
      value: string;
      parameterId?: string;
    }[]
  > => {
    const payload: { fieldId: string; value: string; parameterId?: string }[] =
      [];

    // Add individual field values
    payload.push(
      ...fieldValues.map((fv) => ({
        fieldId: fv.fieldId,
        value: fv.value,
        parameterId: fv.parameterId,
      }))
    );

    // Create personas from group field values
    if (scenario?.group_ids && groups) {
      for (const groupId of scenario.group_ids) {
        const group = groups.find((g) => g.id === groupId);
        if (!group) continue;

        // Get all field values for this group
        const currentGroupFieldValues = [
          group.name_field_id,
          group.voice_field_id,
          group.position_field_id,
          group.level_field_id,
          group.personality_field_id,
        ]
          .map((fieldId) => {
            if (!fieldId) return null;
            return groupFieldValues.find((gfv) => gfv.fieldId === fieldId);
          })
          .filter(Boolean);

        if (currentGroupFieldValues.length > 0) {
          // Find the name field value for the persona name
          const nameFieldValue =
            currentGroupFieldValues.find(
              (gfv) => gfv?.fieldId === group.name_field_id
            )?.value || `Group Persona ${groupId.slice(0, 8)}`;

          // Find voice and personality field values
          const voiceFieldValue = currentGroupFieldValues.find(
            (gfv) => gfv?.fieldId === group.voice_field_id
          );
          const personalityFieldValue = currentGroupFieldValues.find(
            (gfv) => gfv?.fieldId === group.personality_field_id
          );

          // Get the voice and personality personas
          const voicePersona = voiceFieldValue?.parameterId
            ? personas?.find((p) => p.id === voiceFieldValue.parameterId)
            : null;
          const personalityPersona = personalityFieldValue?.parameterId
            ? personas?.find((p) => p.id === personalityFieldValue.parameterId)
            : null;

          if (voicePersona && personalityPersona) {
            try {
              // Create a new persona combining voice and personality
              const newPersona = await createPersona.mutateAsync({
                name: nameFieldValue,
                description: `Generated persona from group: ${
                  group.name || groupId
                }`,
                profile_id: null,
                system_prompt: personalityPersona.system_prompt,
                realtime_prompt: personalityPersona.realtime_prompt,
                temperature: personalityPersona.temperature,
                voice: voicePersona.voice,
                active: false, // Don't show in dropdowns
              });

              // Add the persona ID to the payload
              if (newPersona.id) {
                payload.push({
                  fieldId: group.personality_field_id || groupId,
                  value: nameFieldValue,
                  parameterId: newPersona.id,
                });
              }
            } catch (error) {
              console.error("Failed to create persona from group:", error);
            }
          }
        }
      }
    }

    return payload;
  };

  // Compute current signature from the visible fieldValues
  const currentSignature = (() => {
    const items = fieldValues.map((fv) => ({
      fieldId: fv.fieldId,
      value: fv.value,
      parameterId: fv.parameterId,
    }));
    return makeSignatureFromPayload(items);
  })();

  // Whether selections changed since last generation in this session
  const hasParamChangesSinceGenerate =
    lastGeneratedSignature !== null &&
    lastGeneratedSignature !== currentSignature;

  // Initialize field values when scenario and training load
  useEffect(() => {
    if (scenario && fields && groups) {
      // Only use individual scenario field_ids for the main fieldValues state
      // Group field_ids will be handled separately within group components
      const individualFieldIds = scenario.field_ids || [];

      const filteredFieldIds = individualFieldIds.filter((fieldId: string) => {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) return false;
        if (field.field_type === "document") {
          return training?.show_documents === true;
        }
        return true;
      });

      setFieldValues(
        filteredFieldIds.map((fieldId: string) => ({
          fieldId,
          value: "",
          parameterId: undefined,
        }))
      );

      // Initialize group field values separately using specific field IDs
      const groupFieldIds = (scenario.group_ids || [])
        .map((groupId: string) => {
          const group = groups.find((g) => g.id === groupId);
          if (!group) return [];

          // Return field IDs in the specified order: name, voice, position, level, personality
          const fieldIds = [
            group.name_field_id,
            group.voice_field_id,
            group.position_field_id,
            group.level_field_id,
            group.personality_field_id,
          ].filter(
            (fieldId): fieldId is string =>
              fieldId !== null && fieldId !== undefined
          );

          return fieldIds;
        })
        .flat();

      const filteredGroupFieldIds = groupFieldIds.filter((fieldId: string) => {
        const field = fields.find((f) => f.id === fieldId);
        if (!field) return false;
        if (field.field_type === "document") {
          return training?.show_documents === true;
        }
        return true;
      });

      setGroupFieldValues(
        filteredGroupFieldIds.map((fieldId: string) => ({
          fieldId,
          value: "",
          parameterId: undefined,
        }))
      );
    }
  }, [scenario, fields, groups, training]);

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (preparingModelTimerRef.current) {
        window.clearTimeout(preparingModelTimerRef.current);
        preparingModelTimerRef.current = null;
      }
    };
  }, []);

  const beginGenerateProgress = () => {
    setGenerateProgress((prev) => ({
      ...prev,
      visible: true,
      completedCount: 0,
      totalTools: 0,
      steps: prev.steps.map((s, i) => ({ ...s, complete: i === 0 })),
    }));
    if (preparingModelTimerRef.current) {
      window.clearTimeout(preparingModelTimerRef.current);
    }
  };

  // Listen for scenario progress events
  useEffect(() => {
    const handleScenarioProgress = (e: CustomEvent) => {
      const data = e.detail || {};

      setGenerateProgress((prev) => {
        const newProgress = { ...prev };

        // Update based on progress type
        switch (data.type) {
          case "start":
            newProgress.totalTools = data.total_tools || 0;
            newProgress.completedCount = 0;
            newProgress.steps = newProgress.steps.map((s, i) => ({
              ...s,
              complete: i === 0,
            }));
            break;

          case "scenario":
            newProgress.completedCount += 1;
            newProgress.steps = newProgress.steps.map((s, i) => ({
              ...s,
              complete: i === 1 ? true : s.complete,
            }));
            break;

          case "objectives":
            newProgress.completedCount += 1;
            newProgress.steps = newProgress.steps.map((s, i) => ({
              ...s,
              complete: i === 2 ? true : s.complete,
            }));
            break;

          case "persona_prompt":
            newProgress.completedCount += 1;
            newProgress.steps = newProgress.steps.map((s, i) => ({
              ...s,
              complete: i === 3 ? true : s.complete,
            }));
            break;

          case "document":
            newProgress.completedCount += 1;
            newProgress.steps = newProgress.steps.map((s, i) => ({
              ...s,
              complete: i === 4 ? true : s.complete,
            }));
            break;
        }

        return newProgress;
      });
    };

    window.addEventListener(
      "scenarioProgress",
      handleScenarioProgress as EventListener
    );

    return () => {
      window.removeEventListener(
        "scenarioProgress",
        handleScenarioProgress as EventListener
      );
    };
  }, []);

  // Listen for scenario generated events
  useEffect(() => {
    const handleScenarioGenerated = (e: CustomEvent) => {
      const d = e.detail || {};
      // Ensure this is for our parent scenario id
      if (!scenario) return;
      // Accept any generated child and store its id for Start/Regenerate chaining
      setSavedScenarioId(d.scenario_id || null);
      if (preparingModelTimerRef.current) {
        window.clearTimeout(preparingModelTimerRef.current);
        preparingModelTimerRef.current = null;
      }
      setDraftProblem(d.problem_statement || "");
      setDraftObjectives(Array.isArray(d.objectives) ? d.objectives : []);
      setDraftDocumentIds(Array.isArray(d.document_ids) ? d.document_ids : []);
      setShowGenerateModal(false);
      setIsGenerating(false);
      // Hide the progress shortly after completion
      window.setTimeout(() => {
        setGenerateProgress((prev) => ({ ...prev, visible: false }));
      }, 800);
    };
    window.addEventListener(
      "scenarioGenerated",
      handleScenarioGenerated as EventListener
    );
    return () => {
      window.removeEventListener(
        "scenarioGenerated",
        handleScenarioGenerated as EventListener
      );
    };
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

  const updateGroupFieldValue = (
    fieldId: string,
    value: string,
    parameterId?: string,
    file?: File
  ) => {
    setGroupFieldValues((prev) =>
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
              (p.description || "").toLowerCase() !== "custom scenario" &&
              (p.description || "").trim() !== ""
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
          // Exclude custom persona parameters and inactive personas from autofill
          const candidates = paramsForField
            .filter(
              (p) => (p.description || "").toLowerCase() !== "custom persona"
            )
            .filter((p) => {
              const persona = personas?.find((pp) => pp.id === p.value);
              return persona?.active === true;
            });
          if (candidates.length > 0) {
            const choice = pickRandom(candidates)!;
            // If auto-fill chooses a concrete persona, ensure custom selections are cleared
            return {
              ...fv,
              value: choice.name || "",
              parameterId: choice.id,
            };
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

    // If auto-fill set a concrete persona, clear any "Custom" selection flags
    // by resetting the custom persona-related global state.
    setCustomPersonalityType("");
    setCustomPersonaName("");
    setCustomVoiceType("");
  };

  const isStepComplete = (fieldId: string) => {
    const fieldValue =
      fieldValues.find((fv) => fv.fieldId === fieldId) ||
      groupFieldValues.find((fv) => fv.fieldId === fieldId);
    if (!fieldValue) return false;

    const field = fields?.find((f) => f.id === fieldId);
    if (!field) return false;

    if (field.field_type === "persona") {
      // Optional unless "Custom" selected; then require custom fields
      if (fieldValue.value === "Custom") {
        const nameOk = (customPersonaName || "").trim().length > 0;
        const personalityOk = (customPersonalityType || "").trim().length > 0;
        const voiceOk = (customVoiceType || "").trim().length > 0;
        return nameOk && personalityOk && voiceOk;
      }
      return true;
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

  const allStepsComplete = (() => {
    // Check individual fields
    const individualFieldsComplete =
      fieldValues.length > 0 &&
      fieldValues.every((fv) => {
        const field = fields?.find((f) => f.id === fv.fieldId);
        if (!field) return false;
        if (field.hidden) return true; // hidden fields do not gate UI completion
        if (field.field_type === "document") return true;
        return isStepComplete(fv.fieldId);
      });

    // Check group fields - only if there are groups with fields
    const groupFieldsComplete = (() => {
      if (!scenario?.group_ids || scenario.group_ids.length === 0) {
        return true; // No groups, so group fields are complete
      }

      // Get all field IDs from all groups
      const allGroupFieldIds = scenario.group_ids
        .map((groupId: string) => {
          const group = groups?.find((g) => g.id === groupId);
          if (!group) return [];
          return [
            group.name_field_id,
            group.voice_field_id,
            group.position_field_id,
            group.level_field_id,
            group.personality_field_id,
          ].filter(
            (fieldId): fieldId is string =>
              fieldId !== null && fieldId !== undefined
          );
        })
        .flat();

      if (allGroupFieldIds.length === 0) {
        return true; // No group fields to complete
      }

      // Check if all group fields are complete
      return allGroupFieldIds.every((fieldId) => {
        const fieldValue = groupFieldValues.find(
          (fv) => fv.fieldId === fieldId
        );
        if (!fieldValue) return false; // Field value not found
        return isStepComplete(fieldId);
      });
    })();

    // Both individual and group fields must be complete
    return individualFieldsComplete && groupFieldsComplete;
  })();

  // Determine scenario readiness: problem statement non-empty and >=1 objective (from draft or persisted)
  const scenarioProblem = (
    draftProblem ||
    scenario?.problem_statement ||
    ""
  ).trim();
  const scenarioObjectives =
    draftObjectives && draftObjectives.length > 0
      ? draftObjectives
      : scenario?.objectives || [];
  const scenarioReady =
    scenarioProblem.length > 0 && scenarioObjectives.length >= 1;

  const createDocument = useCreateDocument();
  const createParameterGlobal = useCreateParameter();

  const renderGenerateProgress = () => {
    if (!generateProgress.visible) return null;
    const completed = generateProgress.steps.filter((s) => s.complete).length;
    const percent = Math.round(
      (completed / generateProgress.steps.length) * 100
    );

    return (
      <Box mt="4">
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
          <Box
            style={{
              width: `${percent}%`,
              height: "100%",
              background: "var(--violet-9)",
              transition: "width 300ms ease",
            }}
          />
        </Box>

        <Flex direction="column" gap="2">
          {generateProgress.steps.map((step, idx) => (
            <Flex key={idx} align="center" gap="3">
              <Box
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  border: `2px solid ${
                    step.complete ? "var(--green-9)" : "var(--gray-7)"
                  }`,
                  background: step.complete ? "var(--green-9)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {step.complete ? (
                  <CheckIcon width="10" height="10" color="white" />
                ) : (
                  <Spinner size="1" />
                )}
              </Box>
              <Text size="3" style={{ opacity: step.complete ? 0.8 : 1 }}>
                {step.label}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Box>
    );
  };

  const handleGenerateScenario = async (opts?: {
    additionalPrompt?: string;
  }) => {
    if (!allStepsComplete || !scenario) {
      alert("Please complete all fields before generating the scenario");
      return;
    }

    try {
      setIsGenerating(true);
      beginGenerateProgress();

      const scenarioToUse = savedScenarioId || scenarioId;

      // 1) Upload any document files first (process both individual and group fields)
      const allFieldValues = [...fieldValues, ...groupFieldValues];
      const uploadedFieldValues = await Promise.all(
        allFieldValues.map(async (fieldValue) => {
          if (fieldValue.file) {
            try {
              const document = await createDocument.mutateAsync({
                content: "",
                profile_id: user?.id || null,
              });
              const formData = new FormData();
              formData.append("file", fieldValue.file);
              await uploadDocument(document.id!, formData);
              return {
                ...fieldValue,
                value: document.id!,
                file: undefined,
              } as FieldValue;
            } catch (error) {
              console.error("Error processing document:", error);
              throw new Error(`Failed to process document: ${error}`);
            }
          }
          return fieldValue;
        })
      );

      // 2) Normalize values to parameterIds (text/categorical) and create custom persona if needed
      let nextAssistantPersonaId: string | null = customAssistantPersonaId;
      const normalizedFieldValues = await Promise.all(
        uploadedFieldValues.map(async (fv) => {
          const field = fields?.find((f) => f.id === fv.fieldId);
          if (!field) return fv;

          // Map text values to existing parameter to avoid duplicates
          if (field.field_type === "text" && fv.value) {
            const existing = (allParameters || []).find(
              (p) => p.field_id === field.id && (p.value || "") === fv.value
            );
            if (existing) {
              return { ...fv, parameterId: existing.id };
            }
          }

          // Handle categorical: find existing custom or create one
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
                "Failed to create custom parameter during generate",
                e
              );
            }
          }

          // Handle persona: create custom persona and corresponding parameter
          if (
            field.field_type === "persona" &&
            fv.value === "Custom" &&
            !fv.parameterId
          ) {
            try {
              const basePersona = personas?.find(
                (p) => p.id === customPersonalityType
              );
              if (!basePersona) {
                console.error("Could not find base persona for custom persona");
                return fv;
              }
              const voicePersona = personas?.find(
                (p) => p.id === customVoiceType
              );

              // Build fields based on requested behavior:
              // - Use selected Voice's description and voice
              // - Use selected Personality's realtime_prompt, but replace its first name with the custom name
              const descriptionFromVoice =
                voicePersona?.description ||
                basePersona.description ||
                `Custom persona based on ${basePersona.name}`;

              const baseFirstName =
                (basePersona.name || "").split(" ")[0] || "";
              const escapeRegExp = (s: string) =>
                s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const makeRealtimePrompt = (
                prompt: string | null | undefined
              ) => {
                const text = prompt || "";
                const baseFullName = (basePersona.name || "").trim();
                const chosenFullName = (customPersonaName || "").trim();
                const chosenFirstName = chosenFullName.split(/\s+/)[0] || "";
                const baseOnlyFirstName = baseFirstName;
                if (!baseOnlyFirstName || !chosenFirstName) return text;

                let result = text;
                // 1) Replace full name occurrences with full custom name
                if (baseFullName && chosenFullName) {
                  const fullPattern = new RegExp(
                    `\\b${escapeRegExp(baseFullName)}\\b`,
                    "g"
                  );
                  result = result.replace(fullPattern, chosenFullName);
                }
                // 2) Replace first-name-only occurrences with custom first name
                const firstPattern = new RegExp(
                  `\\b${escapeRegExp(baseOnlyFirstName)}\\b`,
                  "g"
                );
                result = result.replace(firstPattern, chosenFirstName);

                return result;
              };
              const realtimePromptFromPersonality = makeRealtimePrompt(
                basePersona.realtime_prompt
              );

              const newPersona = await createPersona.mutateAsync({
                name: customPersonaName,
                description: descriptionFromVoice,
                profile_id: null,
                system_prompt: basePersona.system_prompt,
                realtime_prompt: realtimePromptFromPersonality,
                temperature: basePersona.temperature,
                voice: voicePersona?.voice || basePersona.voice,
                active: false, // so it does not show up in the persona dropdown
              });

              nextAssistantPersonaId = newPersona.id || null;

              // Create a parameter for this persona field referencing the new persona
              try {
                // Find the base parameter used for the selected personality so we can mirror its label/description
                const baseParameter = (allParameters || []).find(
                  (p) => p.field_id === field.id && p.value === basePersona.id
                );
                const createdParam = await createParameterGlobal.mutateAsync({
                  field_id: field.id,
                  name: baseParameter?.name || "Custom Persona",
                  description: baseParameter?.description,
                  value: newPersona.id,
                });
                if (createdParam?.id) {
                  return { ...fv, parameterId: createdParam.id };
                }
              } catch (e) {
                console.error("Failed to create custom persona parameter", e);
              }

              return fv;
            } catch (e) {
              console.error(
                "Failed to create custom persona during generate",
                e
              );
            }
          }

          return fv;
        })
      );

      // 3) Ensure hidden fields have values
      const withHiddenCompleted = normalizedFieldValues.map((fv) => {
        const field = fields?.find((f) => f.id === fv.fieldId);
        if (!field || !field.hidden) return fv;

        const paramsForField = (allParameters || []).filter(
          (p) => p.field_id === field.id
        );
        const pickRandom = <T,>(arr: T[]): T | undefined =>
          arr[Math.floor(Math.random() * arr.length)];

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
              } as FieldValue;
            }
            return fv;
          }
          case "numerical": {
            const candidates = paramsForField.filter(
              (p) => (p.value || "").trim() !== ""
            );
            const choice = pickRandom(candidates);
            if (choice) {
              return { ...fv, value: choice.value || "" } as FieldValue;
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
                (p.description || "").toLowerCase() !== "custom scenario" &&
                (p.description || "").trim() !== ""
            );
            const pickables = [
              ...normalCandidates.map((p) => ({
                value: p.name || "",
                parameterId: p.id,
              })),
              ...customCandidates.map((p) => ({
                value: p.name || "",
                parameterId: undefined as string | undefined,
              })),
            ];
            const choice = pickRandom(pickables);
            if (choice) {
              return {
                ...fv,
                value: choice.value,
                parameterId: choice.parameterId,
              } as FieldValue;
            }
            return fv;
          }
          case "persona": {
            const nonCustom = paramsForField
              .filter(
                (p) => (p.description || "").toLowerCase() !== "custom persona"
              )
              .filter((p) => {
                const persona = personas?.find((pp) => pp.id === p.value);
                return persona?.active === true;
              });
            const choice = pickRandom(nonCustom);
            if (choice) {
              return {
                ...fv,
                value: choice.name || "",
                parameterId: choice.id,
              } as FieldValue;
            }
            return fv;
          }
          default:
            return fv;
        }
      });

      // 4) Auto-pick an active persona if none selected (and not Custom)
      const personaCompletedFieldValues = withHiddenCompleted.map((fv) => {
        const f = fields?.find((ff) => ff.id === fv.fieldId);
        if (!f) return fv;
        if (
          f.field_type === "persona" &&
          (!fv.parameterId || fv.parameterId.trim() === "") &&
          fv.value !== "Custom"
        ) {
          const candidates = (allParameters || [])
            .filter((p) => p.field_id === f.id)
            .filter(
              (p) => (p.description || "").toLowerCase() !== "custom persona"
            )
            .filter((p) => {
              const persona = personas?.find((pp) => pp.id === p.value);
              return persona?.active === true;
            });
          if (candidates.length > 0) {
            const choice =
              candidates[Math.floor(Math.random() * candidates.length)];
            return { ...fv, value: choice.name || "", parameterId: choice.id };
          }
        }
        return fv;
      });

      // Persist computed values locally for Start flow (separate individual and group fields)
      const individualFields = personaCompletedFieldValues.filter((fv) =>
        fieldValues.some((ifv) => ifv.fieldId === fv.fieldId)
      );
      const groupFields = personaCompletedFieldValues.filter((fv) =>
        groupFieldValues.some((gfv) => gfv.fieldId === fv.fieldId)
      );

      setFieldValues(individualFields);
      setGroupFieldValues(groupFields);
      if (nextAssistantPersonaId !== customAssistantPersonaId) {
        setCustomAssistantPersonaId(nextAssistantPersonaId);
      }

      // 5) Create personas from groups and update scenario parameters on server
      const payloadFieldValues = await createPersonasFromGroupsAndGetPayload();

      // Record this generation's parameters for change detection
      setLastGeneratedSignature(makeSignatureFromPayload(payloadFieldValues));

      emitUpdateScenarioParameters({
        scenario_id: scenarioToUse,
        field_values: payloadFieldValues,
      });

      // 6) Trigger generation
      emitGenerateScenario({
        scenario_id: scenarioToUse,
        field_values: payloadFieldValues,
        additional_prompt: opts?.additionalPrompt || undefined,
        current_draft_objectives: draftObjectives || [],
      });
    } catch (error) {
      console.error("Error generating scenario:", error);
      alert("Failed to generate scenario. Please try again.");
      setIsGenerating(false);
    }
  };

  const startScenario = async () => {
    if (!allStepsComplete || !scenario || !scenarioReady) {
      alert("Please complete all fields and scenario details before starting");
      return;
    }

    setIsLoading(true);

    try {
      // Update active scenario's parameter ids before starting
      const scenarioToUse = savedScenarioId || scenarioId;
      const updateFieldValues = await createPersonasFromGroupsAndGetPayload();

      emitUpdateScenarioParameters({
        scenario_id: scenarioToUse,
        field_values: updateFieldValues,
      });

      // Start training with only scenario_id
      emitStartTraining({
        scenario_id: scenarioToUse,
        profile_id: user?.id || undefined,
      });

      // Note: "Creating scenario" will complete when WebSocket responds
      // The progress will be handled in the WebSocket context
    } catch (error) {
      console.error("Error starting scenario:", error);
      alert("Failed to start scenario. Please try again.");
      setIsLoading(false);
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

        {/* Groups Section */}
        {scenario?.group_ids && scenario.group_ids.length > 0 && groups && (
          <Box maxWidth="800px" mx="auto" mt="4">
            {scenario.group_ids.map((groupId: string) => {
              const group = groups.find((g) => g.id === groupId);
              if (!group) return null;

              return (
                <Card
                  key={groupId}
                  style={{
                    background: "white",
                    border: "1px solid var(--gray-6)",
                    borderRadius: "12px",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                    marginBottom: "16px",
                  }}
                >
                  <Box p="4">
                    {/* Group Field Cards */}
                    {(() => {
                      const hasFields = [
                        group.name_field_id,
                        group.voice_field_id,
                        group.position_field_id,
                        group.level_field_id,
                        group.personality_field_id,
                      ].some(
                        (fieldId) => fieldId !== null && fieldId !== undefined
                      );
                      return hasFields;
                    })() && (
                      <Box>
                        <Flex direction="column" gap="3">
                          {(() => {
                            // Get field IDs in the specified order: name, voice, position, level, personality
                            const orderedFieldIds = [
                              group.name_field_id,
                              group.voice_field_id,
                              group.position_field_id,
                              group.level_field_id,
                              group.personality_field_id,
                            ].filter(
                              (fieldId): fieldId is string =>
                                fieldId !== null && fieldId !== undefined
                            );

                            return orderedFieldIds.map(
                              (fieldId: string, index: number) => {
                                const field = fields?.find(
                                  (f) => f.id === fieldId
                                );
                                if (!field) return null;

                                const fieldValue = groupFieldValues.find(
                                  (fv) => fv.fieldId === fieldId
                                );
                                const isComplete = isStepComplete(fieldId);
                                const isLast =
                                  index === orderedFieldIds.length - 1;

                                return (
                                  <FieldCard
                                    key={fieldId}
                                    fieldId={fieldId}
                                    index={index}
                                    isComplete={isComplete}
                                    value={fieldValue?.value || ""}
                                    onChange={(value, parameterId, file) =>
                                      updateGroupFieldValue(
                                        fieldId,
                                        value,
                                        parameterId,
                                        file
                                      )
                                    }
                                    isLast={isLast}
                                    selectedParameterId={
                                      fieldValue?.parameterId
                                    }
                                    customPersonalityType={
                                      customPersonalityType
                                    }
                                    setCustomPersonalityType={
                                      setCustomPersonalityType
                                    }
                                    customPersonaName={customPersonaName}
                                    setCustomPersonaName={setCustomPersonaName}
                                    customVoiceType={customVoiceType}
                                    setCustomVoiceType={setCustomVoiceType}
                                    hideBorder={true}
                                    hideDivider={true}
                                  />
                                );
                              }
                            );
                          })()}
                        </Flex>
                      </Box>
                    )}
                  </Box>
                </Card>
              );
            })}

            {/* Divider after groups section */}
            {scenario?.group_ids && scenario.group_ids.length > 0 && (
              <Flex justify="center" mb="4" mt="2">
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
          </Box>
        )}

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
                customPersonalityType={customPersonalityType}
                setCustomPersonalityType={setCustomPersonalityType}
                customPersonaName={customPersonaName}
                setCustomPersonaName={setCustomPersonaName}
                customVoiceType={customVoiceType}
                setCustomVoiceType={setCustomVoiceType}
              />
            ))}

          {/* Progress Bar between last field and Generate Scenario */}
          {fieldValues.length > 0 && (
            <Flex justify="center" mb="4">
              <Box
                style={{
                  width: "2px",
                  height: "24px",
                  background: allStepsComplete
                    ? "var(--green-8)"
                    : "var(--gray-6)",
                  borderRadius: "2px",
                }}
              />
            </Flex>
          )}

          {/* Scenario Content - Generate Scenario Step */}
          {((draftProblem && draftProblem.trim().length > 0) ||
            Boolean((scenario?.problem_statement || "").trim())) &&
            !hasParamChangesSinceGenerate && (
              <Box mb="4">
                <Card
                  style={{
                    background: "white",
                    border: `1px solid ${
                      scenarioReady ? "var(--green-8)" : "var(--gray-6)"
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
                          background: scenarioReady
                            ? "var(--green-9)"
                            : "var(--gray-7)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {scenarioReady ? (
                          <CheckIcon color="white" width="16" height="16" />
                        ) : (
                          <Text
                            size="2"
                            weight="bold"
                            style={{ color: "white" }}
                          >
                            {fieldValues.filter((fv) => {
                              const field = fields?.find(
                                (f) => f.id === fv.fieldId
                              );
                              return field ? !field.hidden : true;
                            }).length + 1}
                          </Text>
                        )}
                      </Box>
                      <Box style={{ flex: 1 }}>
                        <Flex align="center" justify="between" mb="3">
                          <Flex align="center" gap="2">
                            <Text size="4" weight="bold">
                              Generate Scenario
                            </Text>
                            {scenarioReady && (
                              <Badge size="1" variant="soft" color="green">
                                Complete
                              </Badge>
                            )}
                          </Flex>
                          <Button
                            size="2"
                            variant="solid"
                            onClick={() => setShowGenerateModal(true)}
                            style={{
                              background: "var(--violet-9)",
                              color: "white",
                            }}
                          >
                            {hasParamChangesSinceGenerate
                              ? "Regenerate Scenario"
                              : "Update Scenario"}
                          </Button>
                        </Flex>
                        <Flex direction="column" gap="3">
                          <Box>
                            <Text size="2" weight="bold" mb="2">
                              Problem Statement
                            </Text>
                            <textarea
                              value={draftProblem}
                              onChange={(e) => setDraftProblem(e.target.value)}
                              rows={5}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                border: "1px solid var(--gray-6)",
                                outline: "none",
                                resize: "vertical",
                              }}
                            />
                          </Box>
                          <Box>
                            <Flex align="center" justify="between" mb="2">
                              <Text size="2" weight="bold">
                                Objectives
                              </Text>
                              <Button
                                size="1"
                                variant="soft"
                                onClick={() =>
                                  setDraftObjectives([
                                    ...(draftObjectives || []),
                                    "",
                                  ])
                                }
                              >
                                Add Objective
                              </Button>
                            </Flex>
                            <Flex direction="column" gap="2">
                              {(draftObjectives || []).map((obj, idx) => (
                                <Flex key={idx} align="center" gap="2">
                                  <input
                                    type="text"
                                    value={obj}
                                    onChange={(e) => {
                                      const next = [...(draftObjectives || [])];
                                      next[idx] = e.target.value;
                                      setDraftObjectives(next);
                                    }}
                                    style={{
                                      flex: 1,
                                      padding: "8px 10px",
                                      borderRadius: "8px",
                                      border: "1px solid var(--gray-6)",
                                      outline: "none",
                                    }}
                                  />
                                  <Button
                                    size="1"
                                    variant="ghost"
                                    onClick={() => {
                                      const next = [...(draftObjectives || [])];
                                      next.splice(idx, 1);
                                      setDraftObjectives(next);
                                    }}
                                  >
                                    ✕
                                  </Button>
                                </Flex>
                              ))}
                            </Flex>
                          </Box>

                          {/* Specifics Section - Document Previews */}
                          {((draftDocumentIds && draftDocumentIds.length > 0) ||
                            (scenario?.document_ids &&
                              scenario.document_ids.length > 0)) && (
                            <Box>
                              <Text size="2" weight="bold" mb="3">
                                Specifics
                              </Text>
                              <Flex
                                wrap="wrap"
                                gap="3"
                                style={{
                                  maxWidth: "600px", // 5 cards * 120px + 4 gaps * 12px = 648px, so 600px fits nicely
                                }}
                              >
                                {(draftDocumentIds.length > 0
                                  ? draftDocumentIds
                                  : scenario?.document_ids || []
                                ).map((docId) => (
                                  <DocumentPreviewCard
                                    key={docId}
                                    documentId={docId}
                                    onClick={() =>
                                      setSelectedDocument({ id: docId })
                                    }
                                  />
                                ))}
                              </Flex>
                            </Box>
                          )}

                          {renderGenerateProgress()}
                        </Flex>
                      </Box>
                    </Flex>
                  </Box>
                </Card>
              </Box>
            )}

          {/* Progress Bar after Generate Scenario step */}
          {((draftProblem && draftProblem.trim().length > 0) ||
            Boolean((scenario?.problem_statement || "").trim())) &&
            !hasParamChangesSinceGenerate && (
              <Flex justify="center" mb="4">
                <Box
                  style={{
                    width: "2px",
                    height: "24px",
                    background: scenarioReady
                      ? "var(--green-8)"
                      : "var(--gray-6)",
                    borderRadius: "2px",
                  }}
                />
              </Flex>
            )}

          {/* Generate Scenario Card - only show when problem statement is empty and no objectives */}
          {((!(
            (draftProblem && draftProblem.trim().length > 0) ||
            Boolean((scenario?.problem_statement || "").trim())
          ) &&
            !(
              (draftObjectives && draftObjectives.length > 0) ||
              (scenario?.objectives && scenario.objectives.length > 0)
            )) ||
            hasParamChangesSinceGenerate) && (
            <Box>
              <Card
                style={{
                  background: "white",
                  border: "1px solid var(--violet-7)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(139, 69, 19, 0.15)",
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
                        background: "var(--violet-9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FileTextIcon color="white" width="16" height="16" />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <Flex align="center" gap="2" mb="3">
                        <Text size="4" weight="bold">
                          Generate Scenario
                        </Text>
                        {allStepsComplete && (
                          <Badge size="1" variant="soft" color="violet">
                            Ready to generate
                          </Badge>
                        )}
                      </Flex>

                      <Button
                        size="3"
                        disabled={!allStepsComplete || isGenerating}
                        onClick={() => handleGenerateScenario()}
                        style={{
                          width: "100%",
                          background: !allStepsComplete
                            ? "var(--gray-7)"
                            : "var(--violet-9)",
                          color: !allStepsComplete ? "var(--gray-11)" : "white",
                        }}
                      >
                        {isGenerating ? (
                          <Flex align="center" gap="2">
                            <Spinner size="2" />
                            <Text>Generating...</Text>
                          </Flex>
                        ) : (
                          <Flex align="center" gap="2">
                            <FileTextIcon />
                            <Text>Generate Scenario</Text>
                          </Flex>
                        )}
                      </Button>
                      {renderGenerateProgress()}
                    </Box>
                  </Flex>
                </Box>
              </Card>
            </Box>
          )}

          {/* Start Button: show only when problem statement exists */}
          {allStepsComplete &&
            scenarioReady &&
            !hasParamChangesSinceGenerate && (
              <Box>
                <Card
                  style={{
                    background:
                      allStepsComplete && scenarioReady
                        ? "white"
                        : "var(--gray-2)",
                    border: `1px solid ${
                      allStepsComplete && scenarioReady
                        ? "var(--blue-7)"
                        : "var(--gray-6)"
                    }`,
                    borderRadius: "12px",
                    boxShadow:
                      allStepsComplete && scenarioReady
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
                          disabled={isLoading}
                          style={{
                            width: "100%",
                            background: "var(--blue-9)",
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
            )}
        </Box>
      </Container>

      {/* Generate Scenario Modal */}
      {showGenerateModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
            onClick={() => setShowGenerateModal(false)}
          >
            <div
              style={{
                width: "min(640px, 92vw)",
                background: "white",
                borderRadius: "12px",
                border: "1px solid var(--gray-6)",
                padding: "20px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Heading size="5" style={{ marginBottom: 8 }}>
                Update Scenario Details
              </Heading>
              <Text size="2" color="gray">
                Specify what you would like to add/remove from the scenario.
              </Text>
              <textarea
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--gray-6)",
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                <Button
                  variant="ghost"
                  size="2"
                  onClick={() => setShowGenerateModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1px solid var(--gray-6)",
                    background: "transparent",
                    color: "var(--gray-11)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--gray-3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="solid"
                  size="2"
                  disabled={isGenerating}
                  onClick={() =>
                    handleGenerateScenario({
                      additionalPrompt: additionalPrompt.trim() || undefined,
                    })
                  }
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "var(--violet-9)",
                    color: "white",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    opacity: isGenerating ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.background = "var(--violet-10)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.background = "var(--violet-9)";
                    }
                  }}
                >
                  {isGenerating ? (
                    <Flex align="center" gap="2">
                      <Spinner size="2" />
                      <Text>Generating...</Text>
                    </Flex>
                  ) : (
                    "Update"
                  )}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={selectedDocument !== null}
        onClose={() => setSelectedDocument(null)}
        documentId={selectedDocument?.id || ""}
      />
    </Box>
  );
}

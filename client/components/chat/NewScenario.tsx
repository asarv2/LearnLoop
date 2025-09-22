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
import React, { useEffect, useRef, useState } from "react";
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
  const createPersonasFromGroupsAndGetPayload = async (): Promise<{
    fieldValues: {
      fieldId: string;
      value: string;
      parameterId?: string;
      personaId?: string;
    }[];
    personaIds: string[];
  }> => {
    const payload: {
      fieldId: string;
      value: string;
      parameterId?: string;
      personaId?: string;
    }[] = [];

    const personaIds: string[] = [];

    // Add user persona ID (from logged-in user)
    if (user?.id) {
      // Find the user persona for this profile
      const userPersona = personas?.find((p) => p.profile_id === user.id);
      if (userPersona && userPersona.id) {
        personaIds.push(userPersona.id);
      }
    }

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
      // First pass: collect all personas and map groupId to persona_id
      const group_persona_map = new Map<string, string>();
      for (const groupId of scenario.group_ids) {
        const group = groups.find((g) => g.id === groupId);
        if (!group) continue;

        // Get all field values for this group (persona first, then mood, position, level, then additional field_ids)
        const currentGroupFieldValues = [
          group.persona_field_id,
          group.mood_field_id,
          group.position_field_id,
          group.level_field_id,
          ...(group.field_ids || []),
        ]
          .filter((fieldId) => {
            if (!fieldId) return false;
            const field = fields?.find((f) => f.id === fieldId);
            // Do not process hidden fields
            return field ? !field.hidden : true;
          })
          .map((fieldId) => {
            return groupFieldValues.find((gfv) => gfv.fieldId === fieldId);
          })
          .filter(Boolean);

        if (currentGroupFieldValues.length > 0) {
          // Find persona field value for persona name
          const personaFieldValue =
            currentGroupFieldValues.find(
              (gfv) => gfv?.fieldId === group.persona_field_id
            )?.value ||
            group.name ||
            `Group Persona ${groupId.slice(0, 8)}`;

          // Find mood field value (required)
          const moodFieldValue = currentGroupFieldValues.find(
            (gfv) => gfv?.fieldId === group.mood_field_id
          );

          // Find level and position field values for enhanced persona description
          const levelFieldValue = currentGroupFieldValues.find(
            (gfv) => gfv?.fieldId === group.level_field_id
          );
          const positionFieldValue = currentGroupFieldValues.find(
            (gfv) => gfv?.fieldId === group.position_field_id
          );

          // Create persona based on persona_field_id, level_field_id, and position_field_id
          // Mood is just a regular parameter, not a persona reference

          // Only create persona if we have the persona field value
          if (personaFieldValue) {
            try {
              // Find the parent persona based on the persona field value
              const parentPersona = personas?.find(
                (p) => p.name === personaFieldValue
              );

              if (!parentPersona) {
                console.warn(
                  `Parent persona "${personaFieldValue}" not found for group ${groupId}`
                );
                continue; // Skip this group if parent persona not found
              }

              // Use parent persona's name, voice, and description
              const personaName = parentPersona.name;
              const personaVoice = parentPersona.voice || "alloy";
              const personaDescription = parentPersona.description || "";

              // Check if a similar persona already exists to avoid duplicates
              const existingPersona = personas?.find(
                (p) =>
                  p.parent_id === parentPersona.id &&
                  p.name === personaName &&
                  p.level ===
                    (() => {
                      const levelValue = levelFieldValue?.value?.toLowerCase();
                      if (levelValue === "mid-level") return "mid";
                      if (
                        levelValue === "junior" ||
                        levelValue === "senior" ||
                        levelValue === "executive"
                      ) {
                        return levelValue as "junior" | "senior" | "executive";
                      }
                      return null;
                    })() &&
                  p.position === positionFieldValue?.value
              );

              let finalPersonaId: string | undefined;

              if (existingPersona) {
                // Use existing persona
                finalPersonaId = existingPersona.id;
                console.log(
                  `Using existing persona: ${existingPersona.name} (${existingPersona.id})`
                );
              } else {
                // Create a new persona with parent persona's name, voice, and description
                const newPersona = await createPersona.mutateAsync({
                  name: personaName,
                  description: personaDescription,
                  profile_id: null,
                  system_prompt: "", // Leave empty
                  realtime_prompt: "", // Leave empty
                  temperature: 0, // Set to 0
                  voice: personaVoice, // Use parent's voice
                  active: false, // Don't show in dropdowns
                  parent_id: parentPersona.id, // Link to the parent persona
                  level: (() => {
                    const levelValue = levelFieldValue?.value?.toLowerCase();
                    // Map database values to schema values
                    if (levelValue === "mid-level") return "mid";
                    if (
                      levelValue === "junior" ||
                      levelValue === "senior" ||
                      levelValue === "executive"
                    ) {
                      return levelValue as "junior" | "senior" | "executive";
                    }
                    return null;
                  })(),
                  position: positionFieldValue?.value || null,
                });
                finalPersonaId = newPersona.id;
                console.log(
                  `Created new persona: ${newPersona.name} (${newPersona.id}) with parent: ${parentPersona.id}`
                );
              }

              // Store the final persona ID (either existing or newly created) in the map
              if (finalPersonaId) {
                group_persona_map.set(groupId, finalPersonaId);
                // Add to personaIds if not already added
                if (!personaIds.includes(finalPersonaId)) {
                  personaIds.push(finalPersonaId);
                }
              }

              // Get the persona_id for this group
              const personaId = group_persona_map.get(groupId);

              // Add other field values to payload (mood, level, position) - these are just string values
              if (moodFieldValue?.value && group.mood_field_id) {
                payload.push({
                  fieldId: group.mood_field_id,
                  value: moodFieldValue.value,
                  parameterId: moodFieldValue.parameterId, // Use existing parameter ID if available
                  personaId: personaId, // Map to persona_id
                });
              }

              // Add additional group field_ids that are mapped to this persona
              if (group.field_ids) {
                for (const additionalFieldId of group.field_ids) {
                  const additionalFieldValue = currentGroupFieldValues.find(
                    (gfv) => gfv?.fieldId === additionalFieldId
                  );
                  if (additionalFieldValue?.value) {
                    payload.push({
                      fieldId: additionalFieldId,
                      value: additionalFieldValue.value,
                      parameterId: additionalFieldValue.parameterId,
                      personaId: personaId, // Map to persona_id
                    });
                  }
                }
              }
            } catch (error) {
              console.error("Failed to create persona from group:", error);
            }
          }
        }
      }
    }

    return {
      fieldValues: payload,
      personaIds: personaIds,
    };
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

      // Create unique field values by combining groupId + fieldId
      const uniqueGroupFieldValues: FieldValue[] = [];
      (scenario.group_ids || []).forEach((groupId: string) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group) return;

        const groupFieldIds = [
          group.persona_field_id,
          group.mood_field_id,
          group.position_field_id,
          group.level_field_id,
          ...(group.field_ids || []),
        ].filter((fieldId): fieldId is string => {
          if (!fieldId) return false;
          const field = fields?.find((f) => f.id === fieldId);
          // Do not render hidden fields in the UI
          return field ? !field.hidden : true;
        });

        groupFieldIds.forEach((fieldId: string) => {
          const field = fields?.find((f) => f.id === fieldId);
          if (!field) return;

          // Check document field visibility
          if (field.field_type === "document") {
            if (!training?.show_documents) return;
          }

          uniqueGroupFieldValues.push({
            fieldId,
            value: "",
            parameterId: undefined,
            groupId, // Add groupId to create unique identifier
          });
        });
      });

      setGroupFieldValues(uniqueGroupFieldValues);
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
      console.log("🎉 Scenario generated event received:", d);
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

  const updateGroupFieldValue = (
    fieldId: string,
    value: string,
    parameterId?: string,
    file?: File,
    groupId?: string
  ) => {
    setGroupFieldValues((prev) =>
      prev.map((fv) =>
        fv.fieldId === fieldId && fv.groupId === groupId
          ? { ...fv, value, parameterId, file }
          : fv
      )
    );
  };

  const handleAutoFill = () => {
    const pickRandom = <T,>(arr: T[]): T | undefined =>
      arr[Math.floor(Math.random() * arr.length)];

    // Helper function to auto-fill a single field value
    const autoFillFieldValue = (fv: FieldValue) => {
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
          (p) =>
            (p.description || "").toLowerCase() ===
            `custom ${field.name?.toLowerCase() || "option"}`
        );
        const normalCandidates = paramsForField.filter(
          (p) =>
            p.value !== null &&
            (p.description || "").toLowerCase() !==
              `custom ${field.name?.toLowerCase() || "option"}` &&
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
            (p) =>
              (p.description || "").toLowerCase() !==
              `custom ${field.name?.toLowerCase() || "persona"}`
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
    };

    // Auto-fill individual fields
    setFieldValues((prev) => prev.map(autoFillFieldValue));

    // Auto-fill group fields
    setGroupFieldValues((prev) => prev.map(autoFillFieldValue));

    // If auto-fill set a concrete persona, clear any "Custom" selection flags
    // by resetting the custom persona-related global state.
    setCustomPersonaName("");
    setCustomVoiceType("");
  };

  const isStepComplete = (fieldId: string, groupId?: string) => {
    let fieldValue: FieldValue | undefined;

    if (groupId) {
      // For group fields, find by both fieldId and groupId
      fieldValue = groupFieldValues.find(
        (fv) => fv.fieldId === fieldId && fv.groupId === groupId
      );
    } else {
      // For regular fields, find by fieldId only
      fieldValue = fieldValues.find((fv) => fv.fieldId === fieldId);
    }

    if (!fieldValue) return false;

    const field = fields?.find((f) => f.id === fieldId);
    if (!field) return false;

    if (field.field_type === "persona") {
      // Required: must have a value selected (either a persona or "Custom")
      if (fieldValue.value === "Custom") {
        const nameOk = (customPersonaName || "").trim().length > 0;
        const voiceOk = (customVoiceType || "").trim().length > 0;
        return nameOk && voiceOk;
      }
      // Must have selected a persona (not empty)
      return fieldValue.value.trim() !== "" && fieldValue.parameterId;
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
    // Check individual fields - handle case where there are no individual fields
    const individualFieldsComplete = (() => {
      // If there are no individual field values, check if there should be any
      if (fieldValues.length === 0) {
        // Check if scenario has any individual field_ids that should be rendered
        const scenarioIndividualFieldIds = scenario?.field_ids || [];
        const visibleIndividualFieldIds = scenarioIndividualFieldIds.filter(
          (fieldId: string) => {
            const field = fields?.find((f) => f.id === fieldId);
            if (!field) return false;
            if (field.hidden) return false; // Hidden fields don't count
            if (field.field_type === "document") {
              return training?.show_documents === true;
            }
            return true;
          }
        );
        // If no visible individual fields should exist, then individual fields are complete
        return visibleIndividualFieldIds.length === 0;
      }

      // If there are individual field values, check they're all complete
      return fieldValues.every((fv) => {
        const field = fields?.find((f) => f.id === fv.fieldId);
        if (!field) return false;
        if (field.hidden) return true; // hidden fields do not gate UI completion
        return isStepComplete(fv.fieldId);
      });
    })();

    // Check group fields - only if there are groups with fields
    const groupFieldsComplete = (() => {
      if (!scenario?.group_ids || scenario.group_ids.length === 0) {
        return true; // No groups, so group fields are complete
      }

      // Check if all group fields are complete by iterating through each group
      for (const groupId of scenario.group_ids) {
        const group = groups?.find((g) => g.id === groupId);
        if (!group) continue;

        const groupFieldIds = [
          group.persona_field_id,
          group.mood_field_id,
          group.position_field_id,
          group.level_field_id,
          ...(group.field_ids || []),
        ].filter((fieldId): fieldId is string => {
          if (!fieldId) return false;
          const field = fields?.find((f) => f.id === fieldId);
          // Do not render hidden fields in the UI
          return field ? !field.hidden : true;
        });

        // If this group has no visible fields, skip it
        if (groupFieldIds.length === 0) {
          continue;
        }

        // Check if all fields in this group are complete
        const groupComplete = groupFieldIds.every((fieldId) =>
          isStepComplete(fieldId, groupId)
        );

        if (!groupComplete) {
          return false; // If any group is incomplete, return false
        }
      }

      return true; // All groups are complete
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
    draftObjectives.length > 0 ? draftObjectives : scenario?.objectives || [];
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
                (p.description || "").toLowerCase() ===
                  `custom ${field.name?.toLowerCase() || "option"}` &&
                (p.name || "") === fv.value
            );
            if (existingCustom) {
              return { ...fv, parameterId: existingCustom.id };
            }
            try {
              const created = await createParameterGlobal.mutateAsync({
                field_id: field.id,
                name: fv.value,
                description: `Custom ${field.name || "Option"}`,
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
              const voicePersona = personas?.find(
                (p) => p.id === customVoiceType
              );

              // Create a simple custom persona with just name and voice
              const newPersona = await createPersona.mutateAsync({
                name: customPersonaName,
                description: `Custom persona: ${customPersonaName}`,
                profile_id: null,
                system_prompt: `You are ${customPersonaName}, a professional employee.`,
                realtime_prompt: `You are ${customPersonaName}. Respond naturally and professionally.`,
                temperature: 0.7, // Default temperature
                voice: voicePersona?.voice || null,
                active: false, // so it does not show up in the persona dropdown
              });

              nextAssistantPersonaId = newPersona.id || null;

              // Create a parameter for this persona field referencing the new persona
              try {
                const createdParam = await createParameterGlobal.mutateAsync({
                  field_id: field.id,
                  name: customPersonaName,
                  description: `Custom ${field.name || "Persona"}`,
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
              (p) =>
                (p.description || "").toLowerCase() ===
                `custom ${field.name?.toLowerCase() || "option"}`
            );
            const normalCandidates = paramsForField.filter(
              (p) =>
                p.value !== null &&
                (p.description || "").toLowerCase() !==
                  `custom ${field.name?.toLowerCase() || "option"}` &&
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
                (p) =>
                  (p.description || "").toLowerCase() !==
                  `custom ${field.name?.toLowerCase() || "persona"}`
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
              (p) =>
                (p.description || "").toLowerCase() !==
                `custom ${f.name?.toLowerCase() || "persona"}`
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
      const { fieldValues: payloadFieldValues, personaIds } =
        await createPersonasFromGroupsAndGetPayload();

      // Record this generation's parameters for change detection
      setLastGeneratedSignature(makeSignatureFromPayload(payloadFieldValues));

      emitUpdateScenarioParameters({
        scenario_id: scenarioToUse,
        field_values: payloadFieldValues,
        persona_ids: personaIds,
      });

      // 6) Trigger generation
      emitGenerateScenario({
        scenario_id: scenarioToUse,
        field_values: payloadFieldValues,
        persona_ids: personaIds,
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
      const { fieldValues: updateFieldValues, personaIds } =
        await createPersonasFromGroupsAndGetPayload();

      emitUpdateScenarioParameters({
        scenario_id: scenarioToUse,
        field_values: updateFieldValues,
        persona_ids: personaIds,
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

      {/* Back Button and Auto-Fill Button */}
      <Container size="4" pt="4" pb="1">
        <Flex justify="between" align="center">
          <Link href="/dashboard/trainings">
            <Button variant="ghost" size="2" style={{ color: "black" }}>
              <ArrowLeftIcon width="16" height="16" />
              Back to Training Dashboard
            </Button>
          </Link>
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
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--violet-9)";
              e.currentTarget.style.transform = "translateY(0px)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
            }}
          >
            Auto-Fill
          </Button>
        </Flex>
      </Container>

      {/* Main Content */}
      <Container size="4" pt="2" pb="8">
        {/* Hero Section */}
        <Box mb="10" style={{ textAlign: "center" }}>
          <Box style={{ marginBottom: "16px" }}>
            <Heading size="9" weight="bold">
              {scenario.title}
            </Heading>
          </Box>
          <Text size="4" color="gray">
            {scenario.description}
          </Text>
        </Box>

        {/* Groups Section */}
        {scenario?.group_ids && scenario.group_ids.length > 0 && groups && (
          <Box maxWidth="800px" mx="auto" mt="4">
            {scenario.group_ids.map((groupId: string, groupIndex: number) => {
              const group = groups.find((g) => g.id === groupId);
              if (!group) return null;

              return (
                <React.Fragment key={groupId}>
                  {/* Green divider between groups */}
                  {groupIndex > 0 && (
                    <Flex justify="center" mb="4">
                      <Box
                        style={{
                          width: "2px",
                          height: "24px",
                          background: "var(--green-8)",
                          borderRadius: "2px",
                        }}
                      />
                    </Flex>
                  )}
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
                          group.persona_field_id,
                          group.mood_field_id,
                          group.position_field_id,
                          group.level_field_id,
                          ...(group.field_ids || []),
                        ].some((fieldId) => {
                          if (!fieldId) return false;
                          const field = fields?.find((f) => f.id === fieldId);
                          // Do not render hidden fields in the UI
                          return field ? !field.hidden : true;
                        });
                        return hasFields;
                      })() && (
                        <Box>
                          <Flex direction="column" gap="3">
                            {(() => {
                              // Get field IDs in the specified order: persona first, then mood, position, level, then additional field_ids
                              const orderedFieldIds = [
                                group.persona_field_id,
                                group.mood_field_id,
                                group.position_field_id,
                                group.level_field_id,
                                ...(group.field_ids || []),
                              ].filter((fieldId): fieldId is string => {
                                if (!fieldId) return false;
                                const field = fields?.find(
                                  (f) => f.id === fieldId
                                );
                                // Do not render hidden fields in the UI
                                return field ? !field.hidden : true;
                              });

                              return orderedFieldIds.map(
                                (fieldId: string, index: number) => {
                                  const field = fields?.find(
                                    (f) => f.id === fieldId
                                  );
                                  if (!field) return null;

                                  const fieldValue = groupFieldValues.find(
                                    (fv) =>
                                      fv.fieldId === fieldId &&
                                      fv.groupId === groupId
                                  );
                                  const isComplete = Boolean(
                                    isStepComplete(fieldId, groupId)
                                  );
                                  const isLast =
                                    index === orderedFieldIds.length - 1;

                                  // Check if this field needs numbering (persona_field_id with multiple instances)
                                  let customFieldName: string | undefined;
                                  if (field.field_type === "text") {
                                    const groupsWithSameNameField = (
                                      scenario.group_ids || []
                                    )
                                      .map((groupId: string) =>
                                        groups.find((g) => g.id === groupId)
                                      )
                                      .filter(
                                        (group) =>
                                          group?.persona_field_id === fieldId
                                      );

                                    if (groupsWithSameNameField.length > 1) {
                                      const currentGroup = groups.find(
                                        (g) =>
                                          g.persona_field_id === fieldId ||
                                          g.mood_field_id === fieldId ||
                                          g.position_field_id === fieldId ||
                                          g.level_field_id === fieldId ||
                                          (g.field_ids || []).includes(fieldId)
                                      );

                                      if (currentGroup) {
                                        const groupIndex =
                                          groupsWithSameNameField.findIndex(
                                            (g) => g?.id === currentGroup.id
                                          );
                                        const baseName = field.name || "Field";
                                        customFieldName = `${baseName} ${
                                          groupIndex + 1
                                        }`;
                                      }
                                    }
                                  }

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
                                          file,
                                          groupId
                                        )
                                      }
                                      isLast={isLast}
                                      selectedParameterId={
                                        fieldValue?.parameterId
                                      }
                                      customPersonaName={customPersonaName}
                                      setCustomPersonaName={
                                        setCustomPersonaName
                                      }
                                      customVoiceType={customVoiceType}
                                      setCustomVoiceType={setCustomVoiceType}
                                      hideBorder={true}
                                      hideDivider={true}
                                      customFieldName={customFieldName}
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
                </React.Fragment>
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
                isComplete={Boolean(isStepComplete(fieldValue.fieldId))}
                value={fieldValue.value}
                onChange={(value, parameterId, file) =>
                  updateFieldValue(fieldValue.fieldId, value, parameterId, file)
                }
                isLast={index === visibleArray.length - 1}
                selectedParameterId={fieldValue.parameterId}
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
            Boolean((scenario?.problem_statement || "").trim())) && (
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
                        <Text size="2" weight="bold" style={{ color: "white" }}>
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
            Boolean((scenario?.problem_statement || "").trim())) && (
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
          {!(
            (draftProblem && draftProblem.trim().length > 0) ||
            Boolean((scenario?.problem_statement || "").trim())
          ) &&
            !(
              (draftObjectives && draftObjectives.length > 0) ||
              (scenario?.objectives && scenario.objectives.length > 0)
            ) && (
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
                            color: !allStepsComplete
                              ? "var(--gray-11)"
                              : "white",
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
          {allStepsComplete && scenarioReady && (
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

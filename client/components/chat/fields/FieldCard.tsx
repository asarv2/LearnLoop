"use client";

import type { Tables } from "@/database.types";
import { useField } from "@/lib/api/hooks/useFields";
import { CheckIcon } from "@radix-ui/react-icons";
import { Badge, Box, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import CategoricalField from "./CategoricalField";
import DocumentField from "./DocumentField";
import NumericalField from "./NumericalField";
import PersonaField from "./PersonaField";
import TextField from "./TextField";
import type { FieldCardProps } from "./types";

export default function FieldCard({
  fieldId,
  index,
  isComplete,
  value,
  onChange,
  isLast,
  selectedParameterId,
  customPersonalityType,
  setCustomPersonalityType,
  customPersonaName,
  setCustomPersonaName,
  customVoiceType,
  setCustomVoiceType,
  hideBorder = false,
  hideDivider = false,
}: FieldCardProps) {
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

    const safeField = field as NonNullable<typeof field>;

    switch (field.field_type) {
      case "text":
        return (
          <TextField
            field={safeField as NonNullable<Tables<"fields">>}
            value={value}
            onChange={handleChange}
          />
        );
      case "numerical":
        return (
          <NumericalField
            field={safeField as NonNullable<Tables<"fields">>}
            value={value}
            onChange={handleChange}
          />
        );
      case "categorical":
        return (
          <CategoricalField
            field={safeField as NonNullable<Tables<"fields">>}
            value={value}
            onChange={handleChange}
            selectedParameterId={selectedParameterId}
          />
        );
      case "document":
        return (
          <DocumentField
            field={safeField as NonNullable<Tables<"fields">>}
            value={value}
            onChange={handleFileChange}
          />
        );
      case "persona":
        return (
          <PersonaField
            field={safeField as NonNullable<Tables<"fields">>}
            onChange={handleChange}
            selectedParameterId={selectedParameterId}
            customPersonalityType={customPersonalityType}
            setCustomPersonalityType={setCustomPersonalityType}
            customPersonaName={customPersonaName}
            setCustomPersonaName={setCustomPersonaName}
            customVoiceType={customVoiceType}
            setCustomVoiceType={setCustomVoiceType}
          />
        );
      default:
        return <Text>Unknown field type: {field.field_type}</Text>;
    }
  };

  const isOptionalField =
    field.field_type === "persona" || field.field_type === "document";

  if (hideBorder) {
    return (
      <>
        <Box mb="2">
          <Box
            style={{
              background: "transparent",
              border: "none",
              borderRadius: "0",
              boxShadow: "none",
              margin: "0",
              padding: "0",
            }}
          >
            <Box p="4">
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
                    {isOptionalField && (
                      <Text size="2" color="gray">
                        (Optional)
                      </Text>
                    )}
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
          </Box>
        </Box>

        {/* Progress Bar */}
        {!isLast && !hideDivider && (
          <Flex justify="center" mb="2">
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

  // Regular Card rendering for individual fields
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
                  {isOptionalField && (
                    <Text size="2" color="gray">
                      (Optional)
                    </Text>
                  )}
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
      {!isLast && !hideDivider && (
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

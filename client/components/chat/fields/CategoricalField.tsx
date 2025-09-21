"use client";

import { useParametersByField } from "@/lib/api/hooks/useParameters";
import { CheckIcon } from "@radix-ui/react-icons";
import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CategoricalFieldProps } from "./types";

export default function CategoricalField({
  field,
  value,
  onChange,
  selectedParameterId,
}: CategoricalFieldProps) {
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

  // Hide custom-created parameters and those with empty/null descriptions
  const displayedParameters = parameters?.filter((p) => {
    // Always include the currently selected parameter so it stays visible
    if (selectedParameterId && p.id === selectedParameterId) return true;
    return (
      (p.description || "").toLowerCase() !==
        `custom ${field.name?.toLowerCase() || "option"}` &&
      (p.description || "").trim() !== ""
    );
  });

  // Suggestions for custom entries (only parameters with field-specific custom description)
  const customSuggestions = (() => {
    const itemsMap = new Map<string, { id: string; updatedAt: string }>();
    (parameters || [])
      .filter(
        (p) =>
          (p.description || "").toLowerCase() ===
          `custom ${field.name?.toLowerCase() || "option"}`
      )
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

  if (isLoading) return <div>Loading...</div>;

  return (
    <Flex direction="column" gap="3">
      {displayedParameters
        ?.sort((a, b) => b.updated_at?.localeCompare(a.updated_at || "") || 0)
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
                        flexShrink: 0,
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
                        placeholder={`Enter your own custom ${
                          field.name?.toLowerCase() || "option"
                        } to practice...`}
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

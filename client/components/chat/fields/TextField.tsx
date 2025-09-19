"use client";

import { useParametersByField } from "@/lib/api/hooks/useParameters";
import { Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FieldProps } from "./types";

export default function TextField({ field, value, onChange }: FieldProps) {
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

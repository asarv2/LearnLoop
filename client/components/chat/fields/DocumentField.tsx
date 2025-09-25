"use client";

import { CheckIcon, FileTextIcon } from "@radix-ui/react-icons";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";
import type { DocumentFieldProps } from "./types";

export default function DocumentField({
  field,
  value,
  onChange,
}: DocumentFieldProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // ✅ pass the display value (name) AND the File so upstream can store both
      onChange(file.name, undefined, file);
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

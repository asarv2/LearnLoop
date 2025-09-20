"use client";

import { useDocument } from "@/lib/api/hooks/useDocuments";
import { FileTextIcon } from "@radix-ui/react-icons";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useState } from "react";

interface DocumentPreviewCardProps {
  documentId: string;
  onClick: () => void;
}

export default function DocumentPreviewCard({
  documentId,
  onClick,
}: DocumentPreviewCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { data: document } = useDocument(documentId);

  return (
    <Box
      style={{
        width: "120px",
        height: "120px",
        border: "1px solid var(--gray-6)",
        borderRadius: "8px",
        background: isHovered ? "var(--gray-2)" : "white",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: isHovered
          ? "0 4px 12px rgba(0, 0, 0, 0.15)"
          : "0 1px 3px rgba(0, 0, 0, 0.1)",
        transform: isHovered ? "translateY(-2px)" : "translateY(0px)",
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Flex
        direction="column"
        align="center"
        justify="center"
        style={{ height: "100%", padding: "12px" }}
      >
        <FileTextIcon width="32" height="32" color="var(--violet-9)" />
        <Text
          size="1"
          weight="medium"
          style={{
            textAlign: "center",
            marginTop: "8px",
            lineHeight: "1.2",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            color: "black",
          }}
        >
          {document?.title || "Document"}
        </Text>
      </Flex>
    </Box>
  );
}

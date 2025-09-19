"use client";

import { useDocument } from "@/lib/api/hooks/useDocuments";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Box, Button, Flex, Heading } from "@radix-ui/themes";
import { createPortal } from "react-dom";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
}

export default function DocumentViewerModal({
  isOpen,
  onClose,
  documentId,
}: DocumentViewerModalProps) {
  const { data: documentData } = useDocument(documentId, isOpen);

  if (!isOpen || typeof documentData === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(90vw, 1200px)",
          height: "min(90vh, 800px)",
          background: "white",
          borderRadius: "12px",
          border: "1px solid var(--gray-6)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Flex
          align="center"
          justify="between"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--gray-6)",
            background: "var(--gray-1)",
          }}
        >
          <Heading size="4" weight="bold">
            {documentData?.content || "Document"}
          </Heading>
          <Button
            variant="ghost"
            size="2"
            onClick={onClose}
            style={{
              padding: "8px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            <Cross2Icon width="16" height="16" />
          </Button>
        </Flex>

        {/* Document Content */}
        <Box style={{ flex: 1, position: "relative" }}>
          <iframe
            src={`/api/v1/documents/${documentId}/file`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title={documentData?.content || "Document"}
          />
        </Box>
      </div>
    </div>,
    document.body
  );
}

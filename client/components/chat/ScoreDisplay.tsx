import { Chat } from "@/types";
import { Box, Text } from "@radix-ui/themes";

interface ScoreDisplayProps {
  score: number | null | undefined;
  chat?: Chat;
}

// Category names are now driven by data outside this component.

const PRIMARY_COLOR = "#2563eb"; // Strong blue for scores and highlights
const TEXT_COLOR = "#1e293b"; // Dark blue-gray for text
const SUBTLE_TEXT = "#64748b"; // Subtle gray for secondary text

const getScoreColor = () => PRIMARY_COLOR;

export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  if (!score) {
    return (
      <Box style={{ padding: "2rem", textAlign: "center" }}>
        <Text size="3" style={{ color: SUBTLE_TEXT }}>
          No performance score available yet.
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ padding: "2rem", background: "#fff", color: TEXT_COLOR }}>
      {/* Overall Score */}
      <Box style={{ textAlign: "center", marginBottom: "2rem" }}>
        <Text size="2" style={{ color: SUBTLE_TEXT, marginBottom: "0.5rem" }}>
          Overall Performance Score
        </Text>
        <Box
          style={{
            fontSize: "3rem",
            fontWeight: "bold",
            color: getScoreColor(),
            marginBottom: "0.5rem",
            letterSpacing: "-1px",
          }}
        >
          {score}
        </Box>
        <Text size="2" style={{ color: SUBTLE_TEXT }}>
          out of 100
        </Text>
      </Box>

      {/* Category breakdown now shown by FeedbackModal using standard grades */}
    </Box>
  );
}

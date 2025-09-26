// lib/renderMessageContent.ts
import type { Message } from "@/types";

type TranscriptWord = { start_ms: number; end_ms: number; text: string };

export function renderMessageContent(
  message: Message,
  {
    nowMs,
    transcripts,
    transcriptStops,
  }: {
    nowMs: number;
    transcripts: Record<
      string,
      { start_ts_ms: number; words: TranscriptWord[]; text: string }
    >;
    transcriptStops: Record<string, number>;
  }
): string {
  const isAssistant = message.role === "assistant";
  const tr = transcripts[message.id];

  // 1) Live transcript-first rendering
  if (isAssistant && tr && Array.isArray(tr.words) && tr.words.length > 0) {
    const start = Number(tr.start_ts_ms) || 0;
    const stop = transcriptStops[message.id];
    let elapsed = nowMs - start;
    if (Number.isFinite(stop)) elapsed = Math.min(elapsed, stop - start);
    if (elapsed <= 0) return "";
    return tr.words
      .filter((w) => w.start_ms <= elapsed)
      .map((w) => w.text)
      .join(" ")
      .replace(/\s+([,.;!?])/g, "$1");
  }

  // 2) Historical interruption clamp (if stored)
  try {
    const wtAny = (message as unknown as { word_timestamps?: unknown })
      .word_timestamps;
    const interruption = (
      message as unknown as { interruption_ms?: number | null }
    ).interruption_ms;
    const hasWT = Array.isArray(wtAny) && wtAny.length > 0;

    if (
      isAssistant &&
      hasWT &&
      typeof interruption === "number" &&
      interruption > 0
    ) {
      const words = (wtAny as Array<unknown>)
        .map((w) => {
          const obj = w as {
            start_ms?: unknown;
            end_ms?: unknown;
            text?: unknown;
          };
          return {
            start_ms: Number(obj?.start_ms ?? 0),
            end_ms: Number(obj?.end_ms ?? 0),
            text: String(obj?.text ?? ""),
          };
        })
        .filter(
          (w) =>
            Number.isFinite(w.start_ms) && Number.isFinite(w.end_ms) && !!w.text
        )
        .sort((a, b) => a.start_ms - b.start_ms);

      const visible = words.filter((w) => w.end_ms <= interruption);
      if (visible.length > 0) {
        return visible
          .map((w) => w.text)
          .join(" ")
          .replace(/\s+([,.;!?])/g, "$1");
      }
    }
  } catch {}

  // 3) Fallback plain content
  return message.content || "";
}

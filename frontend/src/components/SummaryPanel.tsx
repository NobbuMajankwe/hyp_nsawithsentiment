// ---------------------------------------------------------------------------
// Summary panel
// ---------------------------------------------------------------------------

import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import type { SentimentItem, SentimentLabel } from "../types";
import { CheckCircle2, Minus, Terminal, ThumbsDown, ThumbsUp } from "lucide-react";

const LABEL_COLORS: Record<SentimentLabel, string> = {
  Positive: "#22c55e",
  Negative: "#ef4444",
  Neutral: "#f59e0b",
};
const LABEL_ICONS: Record<SentimentLabel, React.ReactNode> = {
  Positive: <ThumbsUp size={14} />,
  Negative: <ThumbsDown size={14} />,
  Neutral: <Minus size={14} />,
};

const SENTIMENT_PURPLE = "#a78bfa";
const PANEL_BG = "#050816";
const INNER_BG = "#020617";
const PRIMARY_TEXT = "#f8fafc";
const SECONDARY_TEXT = "#94a3b8";
const MUTED_TEXT = "#64748b";
const PANEL_BORDER = "rgba(139,92,246,0.22)";

export function SummaryPanel({
  summary,
  results,
}: {
  summary: {
    pos: number;
    neg: number;
    neu: number;
    total: number;
  } | null;
  results: SentimentItem[];
}) {
  if (!summary || results.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 4,
          bgcolor: PANEL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          boxShadow: "0 0 30px rgba(139,92,246,0.06)",
        }}
      >
        <Stack spacing={1} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
         
        <Terminal size={16} color="#22d3ee" />
          <Typography
            variant="caption"
            sx={{
              color: "#22d3ee",
              textTransform: "uppercase",
              letterSpacing: 1,
              fontWeight: 800,
            }}
          >
           ~/eventsense-ai/findings
        </Typography>
        </Stack>
        
        <Typography variant="h5" sx={{ fontWeight: 900, color: "#f8fafc" }}>
          &gt; signal_summary<span style={{ color: "#22d3ee" }}>()</span>
        </Typography>
      </Stack>
        <Typography
          sx={{
            color: SECONDARY_TEXT,
            fontFamily: "monospace",
            fontSize: "0.8rem",
            lineHeight: 1.7,
          }}
        >
          No inference output available. Run the classifier to populate this
          panel.
        </Typography>
      </Paper>
    );
  }

  const dominantLabel: SentimentLabel =
    summary.pos >= summary.neg && summary.pos >= summary.neu
      ? "Positive"
      : summary.neg >= summary.pos && summary.neg >= summary.neu
      ? "Negative"
      : "Neutral";

  const dominantColor = LABEL_COLORS[dominantLabel];

  const stats = [
    {
      label: "total_records",
      value: summary.total,
      color: "#67e8f9",
    },
    {
      label: "positive",
      value: summary.pos,
      color: LABEL_COLORS.Positive,
    },
    {
      label: "negative",
      value: summary.neg,
      color: LABEL_COLORS.Negative,
    },
    {
      label: "neutral",
      value: summary.neu,
      color: LABEL_COLORS.Neutral,
    },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        bgcolor: PANEL_BG,
        color: "#e5e7eb",
        border: `1px solid ${PANEL_BORDER}`,
        boxShadow: "0 0 35px rgba(139,92,246,0.08)",
      }}
    >
      <Stack spacing={0.6} sx={{ mb: 3 }}>
        <Typography
          sx={{
            color: SENTIMENT_PURPLE,
            fontFamily: "monospace",
            fontWeight: 900,
            fontSize: "0.72rem",
          }}
        >
          $ sentiment_summary()
        </Typography>

        <Typography
          variant="h5"
          sx={{
            color: PRIMARY_TEXT,
            fontWeight: 900,
            fontFamily: "monospace",
          }}
        >
          &gt; signal_overview
        </Typography>
      </Stack>

      <Box
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          bgcolor: INNER_BG,
          border: `1px solid ${dominantColor}35`,
          boxShadow: `0 0 20px ${dominantColor}12`,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: `${dominantColor}12`,
              color: dominantColor,
              border: `1px solid ${dominantColor}35`,
            }}
          >
            {LABEL_ICONS[dominantLabel]}
          </Box>

          <Box>
            <Typography
              sx={{
                color: dominantColor,
                fontSize: "1.7rem",
                fontWeight: 900,
                fontFamily: "monospace",
                lineHeight: 1,
              }}
            >
              {dominantLabel.toLowerCase()}
            </Typography>

            <Typography
              sx={{
                mt: 0.5,
                color: MUTED_TEXT,
                fontFamily: "monospace",
                fontSize: "0.7rem",
              }}
            >
              dominant_sentiment
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Stack spacing={1.1} sx={{ mb: 3 }}>
        {stats.map((stat) => (
          <Stack
            key={stat.label}
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              pb: 1,
              borderBottom: "1px dashed rgba(148,163,184,0.12)",
            }}
          >
            <Typography
              sx={{
                color: SECONDARY_TEXT,
                fontFamily: "monospace",
                fontSize: "0.75rem",
              }}
            >
              {stat.label}
            </Typography>

            <Typography
              sx={{
                color: stat.color,
                fontWeight: 900,
                fontFamily: "monospace",
              }}
            >
              {stat.value}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ mb: 2, borderColor: "rgba(148,163,184,0.12)" }} />

      <Box
        sx={{
          p: 2.2,
          borderRadius: 3,
          bgcolor: INNER_BG,
          border: "1px solid rgba(249,115,22,0.22)",
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
          <CheckCircle2 size={14} color="#f97316" />

          <Typography
            sx={{
              color: "#fdba74",
              fontWeight: 900,
              fontFamily: "monospace",
              fontSize: "0.78rem",
            }}
          >
            pipeline.next()
          </Typography>
        </Stack>

        <Typography
          sx={{
            color: "#cbd5e1",
            lineHeight: 1.7,
            fontFamily: "monospace",
            fontSize: "0.76rem",
          }}
        >
          {summary.total} record{summary.total !== 1 ? "s" : ""} classified.
          <br />
          positive = {summary.pos}
          <br />
          negative = {summary.neg}
          <br />
          neutral = {summary.neu}
        </Typography>

        <Chip
          label="$ insight_story --ready"
          size="small"
          sx={{
            mt: 2,
            bgcolor: "rgba(249,115,22,0.10)",
            color: "#fb923c",
            border: "1px solid rgba(249,115,22,0.30)",
            fontFamily: "monospace",
            fontWeight: 900,
          }}
        />
      </Box>
    </Paper>
  );
}
import {
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { ShieldCheck, ShieldAlert, Tag, Terminal } from "lucide-react";
import type { AnalysisResult } from "../types";

interface Props {
  results: AnalysisResult[];
}

export function FeedbackCanvas({ results }: Props) {
  if (results.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 4,
          bgcolor: "#050816",
          color: "#e5e7eb",
          border: "1px solid rgba(34,211,238,0.25)",
          boxShadow: "0 0 40px rgba(34,211,238,0.08)",
          textAlign: "center",
          fontFamily: "monospace",
        }}
      >
        <Terminal size={32} color="#22d3ee" />
        <Typography sx={{ mt: 2, color: "#94a3b8" }}>
          $ paste feedback above && run{" "}
          <strong style={{ color: "#22d3ee" }}>./run_nsa_scan</strong>
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 4 },
        borderRadius: 4,
        bgcolor: "#050816",
        color: "#e5e7eb",
        border: "1px solid rgba(34,211,238,0.25)",
        boxShadow: "0 0 40px rgba(34,211,238,0.08)",
        fontFamily: "monospace",
      }}
    >
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography
          variant="caption"
          sx={{
            color: "#22d3ee",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 800,
          }}
        >
          ~/eventsense-ai/output-canvas
        </Typography>

        <Typography variant="h4" sx={{ fontWeight: 900, color: "#f8fafc" }}>
          &gt; analysed_records<span style={{ color: "#22d3ee" }}>[]</span>
        </Typography>

        <Typography sx={{ color: "#94a3b8" }}>
          NSA scan results rendered from the feedback buffer.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          gap: 3,
        }}
      >
        {results.map((item) => (
          <RecordCard key={item.id} item={item} />
        ))}
      </Box>
    </Paper>
  );
}

function RecordCard({ item }: { item: AnalysisResult }) {
  const suspicious = item.nsaStatus === "Suspicious";

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: suspicious ? "rgba(127,29,29,0.35)" : "rgba(6,78,59,0.25)",
        border: "1px solid",
        borderColor: suspicious
          ? "rgba(248,113,113,0.45)"
          : "rgba(34,211,238,0.28)",
        transition: "0.25s",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: suspicious
            ? "0 0 28px rgba(239,68,68,0.18)"
            : "0 0 28px rgba(34,211,238,0.18)",
        },
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            color: "#94a3b8",
            fontFamily: "monospace",
          }}
        >
          record_id: #{item.id}
        </Typography>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {suspicious ? (
            <ShieldAlert size={16} color="#f87171" />
          ) : (
            <ShieldCheck size={16} color="#22d3ee" />
          )}

          <Chip
            label={item.nsaStatus.toLowerCase()}
            size="small"
            sx={{
              fontWeight: 800,
              fontFamily: "monospace",
              bgcolor: suspicious
                ? "rgba(239,68,68,0.15)"
                : "rgba(34,211,238,0.12)",
              color: suspicious ? "#fca5a5" : "#67e8f9",
              border: "1px solid",
              borderColor: suspicious
                ? "rgba(248,113,113,0.45)"
                : "rgba(34,211,238,0.45)",
            }}
          />
        </Stack>
      </Stack>

      <Typography
        sx={{
          fontSize: "0.95rem",
          lineHeight: 1.8,
          mb: 2.5,
          color: "#e5e7eb",
        }}
      >
        <span style={{ color: "#22d3ee" }}>raw:</span> "{item.originalText}"
      </Typography>

      <Box
        sx={{
          p: 1.5,
          mb: 2.5,
          borderRadius: 2,
          bgcolor: "#020617",
          border: "1px solid rgba(148,163,184,0.2)",
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            color: "#22d3ee",
            display: "block",
            mb: 0.5,
          }}
        >
          cleaned_output
        </Typography>

        <Typography
          variant="body2"
          sx={{ fontFamily: "monospace", color: "#bbf7d0" }}
        >
          {item.cleanedText || "null"}
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 0.75,
          alignItems: "center",
          mb: 2.5,
        }}
      >
        <Tag size={14} style={{ flexShrink: 0, color: "#22d3ee" }} />

        {item.tokens.length > 0 ? (
          item.tokens.map((token) => (
            <Chip
              key={token}
              label={token}
              size="small"
              sx={{
                bgcolor: "rgba(15,23,42,0.95)",
                color: "#cbd5e1",
                border: "1px solid rgba(148,163,184,0.22)",
                fontFamily: "monospace",
                fontSize: "0.72rem",
              }}
            />
          ))
        ) : (
          <Typography variant="caption" sx={{ color: "#64748b" }}>
            no meaningful tokens
          </Typography>
        )}
      </Box>

      <Stack spacing={0.7} sx={{ mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography
            variant="caption"
            sx={{ color: "#94a3b8", fontWeight: 800 }}
          >
            anomaly_score
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 900, color: "#f8fafc" }}
          >
            {item.anomalyScore}%
          </Typography>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={item.anomalyScore}
          sx={{
            height: 9,
            borderRadius: 99,
            bgcolor: "rgba(148,163,184,0.16)",
            "& .MuiLinearProgress-bar": {
              borderRadius: 99,
              bgcolor: suspicious ? "#f87171" : "#22d3ee",
              boxShadow: suspicious
                ? "0 0 14px rgba(248,113,113,0.65)"
                : "0 0 14px rgba(34,211,238,0.65)",
            },
          }}
        />
      </Stack>

      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          bgcolor: suspicious ? "rgba(127,29,29,0.35)" : "rgba(6,78,59,0.25)",
          border: "1px solid rgba(148,163,184,0.16)",
        }}
      >
        <Typography variant="body2" sx={{ color: "#cbd5e1", lineHeight: 1.7 }}>
          <span
            style={{
              color: suspicious ? "#f87171" : "#22d3ee",
              fontWeight: 800,
            }}
          >
            reason:
          </span>{" "}
          {item.anomalyReason}
        </Typography>
      </Box>
    </Paper>
  );
}

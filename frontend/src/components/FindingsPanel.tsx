import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { AlertTriangle, CheckCircle2, BarChart2, Terminal } from "lucide-react";
import type { AnalysisResult } from "../types";
import type { AnalyseResponse } from "../services/api";

interface Props {
  summary: AnalyseResponse | null;
  results: AnalysisResult[];
}

export function FindingsPanel({ summary, results }: Props) {
  const total = summary?.totalRecords ?? results.length;
  const suspicious =
    summary?.suspiciousRecords ??
    results.filter((r) => r.nsaStatus === "Suspicious").length;
  const valid = summary?.validRecords ?? total - suspicious;

  const topAnomaly = results.find((r) => r.nsaStatus === "Suspicious");

  return (
    <Paper
      component="aside"
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        bgcolor: "#050816",
        color: "#e5e7eb",
        border: "1px solid rgba(34,211,238,0.25)",
        boxShadow: "0 0 40px rgba(34,211,238,0.08)",
        position: { lg: "sticky" },
        top: 24,
        height: "fit-content",
        fontFamily: "monospace",
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

      {/* Suspicious count hero */}
      <Box
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          bgcolor:
            suspicious > 0 ? "rgba(127,29,29,0.35)" : "rgba(6,78,59,0.28)",
          border: "1px solid",
          borderColor:
            suspicious > 0 ? "rgba(248,113,113,0.45)" : "rgba(34,211,238,0.35)",
          display: "flex",
          alignItems: "center",
          gap: 2,
          boxShadow:
            suspicious > 0
              ? "0 0 24px rgba(239,68,68,0.12)"
              : "0 0 24px rgba(34,211,238,0.12)",
        }}
      >
        {suspicious > 0 ? (
          <AlertTriangle size={28} color="#f87171" />
        ) : (
          <CheckCircle2 size={28} color="#22d3ee" />
        )}

        <Box>
          <Typography
            sx={{
              fontSize: "2.4rem",
              fontWeight: 900,
              lineHeight: 1,
              color: suspicious > 0 ? "#f87171" : "#22d3ee",
              fontFamily: "monospace",
            }}
          >
            {suspicious}
          </Typography>

          <Typography variant="body2" sx={{ mt: 0.5, color: "#94a3b8" }}>
            suspicious_record{suspicious !== 1 ? "s" : ""}_detected
          </Typography>
        </Box>
      </Box>

      {/* Stat grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 1.5,
          mb: 3,
        }}
      >
        <MiniStat label="total_records" value={total} color="#67e8f9" />
        <MiniStat label="valid" value={valid} color="#22c55e" />
        <MiniStat label="suspicious" value={suspicious} color="#f87171" />
        <MiniStat
          label="pass_rate"
          value={total > 0 ? `${Math.round((valid / total) * 100)}%` : "—"}
          color="#a78bfa"
        />
      </Box>

      <InsightBox icon={<BarChart2 size={14} />} title="main_anomaly_pattern">
        {topAnomaly
          ? topAnomaly.anomalyReason
          : results.length === 0
          ? "Awaiting dataset scan..."
          : "No suspicious patterns detected in this dataset."}
      </InsightBox>

      <InsightBox icon={<CheckCircle2 size={14} />} title="pipeline_status">
        {results.length === 0
          ? "NSA engine idle. Waiting for feedback buffer."
          : `${valid} record${
              valid !== 1 ? "s" : ""
            } cleared for sentiment analysis. ${
              suspicious > 0
                ? `${suspicious} blocked by NSA filter.`
                : "All records valid."
            }`}
      </InsightBox>
    </Paper>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: "#020617",
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "inset 0 0 18px rgba(15,23,42,0.8)",
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontWeight: 900,
          color,
          fontFamily: "monospace",
        }}
      >
        {value}
      </Typography>

      <Typography
        variant="caption"
        sx={{
          color: "#94a3b8",
          fontFamily: "monospace",
        }}
      >
        {label}
      </Typography>
    </Paper>
  );
}

function InsightBox({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        mt: 2,
        borderRadius: 3,
        bgcolor: "#020617",
        border: "1px solid rgba(34,211,238,0.18)",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Box sx={{ color: "#22d3ee", display: "flex" }}>{icon}</Box>

        <Chip
          label="INSIGHT"
          size="small"
          sx={{
            height: 22,
            fontSize: "0.68rem",
            fontWeight: 900,
            fontFamily: "monospace",
            bgcolor: "rgba(34,211,238,0.12)",
            color: "#67e8f9",
            border: "1px solid rgba(34,211,238,0.35)",
          }}
        />

        <Typography
          sx={{
            fontWeight: 900,
            fontSize: "0.86rem",
            color: "#e5e7eb",
            fontFamily: "monospace",
          }}
        >
          {title}
        </Typography>
      </Stack>

      <Typography
        variant="body2"
        sx={{
          color: "#94a3b8",
          lineHeight: 1.7,
          fontFamily: "monospace",
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

import type { ReactNode } from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Minus,
  Terminal,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

import type {
  AnalysisResult,
  SentimentItem,
  SentimentLabel,
} from "../types";
import type { AnalyseResponse } from "../services/api";

type SentimentSummary = {
  pos: number;
  neg: number;
  neu: number;
  total: number;
};

type CommonProps = {
  sticky?: boolean;
};

type NsaProps = CommonProps & {
  mode: "nsa";
  summary: AnalyseResponse | null;
  results: AnalysisResult[];
};

type SentimentProps = CommonProps & {
  mode: "sentiment";
  summary: SentimentSummary | null;
  results: SentimentItem[];
};

type SignalSummaryPanelProps = NsaProps | SentimentProps;

type Stat = {
  label: string;
  value: number | string;
  color: string;
};

const COLORS = {
  panel: "#050816",
  inner: "#020617",
  primaryText: "#f8fafc",
  secondaryText: "#94a3b8",
  cyan: "#22d3ee",
  cyanLight: "#67e8f9",
  green: "#22c55e",
  red: "#f87171",
  purple: "#a78bfa",
  amber: "#f59e0b",
};

const SENTIMENT_COLORS: Record<SentimentLabel, string> = {
  Positive: COLORS.green,
  Negative: "#ef4444",
  Neutral: COLORS.amber,
};

const SENTIMENT_ICONS: Record<SentimentLabel, ReactNode> = {
  Positive: <ThumbsUp size={20} />,
  Negative: <ThumbsDown size={20} />,
  Neutral: <Minus size={20} />,
};

export function SignalSummaryPanel(props: SignalSummaryPanelProps) {
  const { mode, sticky = true } = props;
  const isEmpty = !props.summary || props.results.length === 0;
  const accent = mode === "nsa" ? COLORS.cyan : COLORS.purple;

  return (
    <Paper
      component="aside"
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        bgcolor: COLORS.panel,
        color: "#e5e7eb",
        border: `1px solid ${accent}40`,
        boxShadow: `0 0 40px ${accent}14`,
        position: sticky ? { lg: "sticky" } : "static",
        top: sticky ? 24 : undefined,
        height: "fit-content",
        fontFamily: "monospace",
      }}
    >
      <PanelHeader mode={mode} accent={accent} />

      {isEmpty ? (
        <EmptyState mode={mode} />
      ) : mode === "nsa" ? (
        <NsaContent summary={props.summary} results={props.results} />
      ) : (
        <SentimentContent summary={props.summary} />
      )}
    </Paper>
  );
}

function PanelHeader({
  mode,
  accent,
}: {
  mode: "nsa" | "sentiment";
  accent: string;
}) {
  return (
    <Stack spacing={1} sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Terminal size={16} color={accent} />
        <Typography
          variant="caption"
          sx={{
            color: accent,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 800,
          }}
        >
          ~/eventsense-ai/{mode}
        </Typography>
      </Stack>

      <Typography variant="h5" sx={{ fontWeight: 900, color: COLORS.primaryText }}>
        &gt; signal_summary<span style={{ color: accent }}>()</span>
      </Typography>
    </Stack>
  );
}

function EmptyState({ mode }: { mode: "nsa" | "sentiment" }) {
  return (
    <Typography
      sx={{
        color: COLORS.secondaryText,
        fontFamily: "monospace",
        fontSize: "0.8rem",
        lineHeight: 1.7,
      }}
    >
      {mode === "nsa"
        ? "No NSA output available. Run the anomaly scan to populate this panel."
        : "No sentiment output available. Run the classifier to populate this panel."}
    </Typography>
  );
}

function NsaContent({
  summary,
  results,
}: {
  summary: AnalyseResponse;
  results: AnalysisResult[];
}) {
  const total = summary.totalRecords ?? results.length;
  const suspicious =
    summary.suspiciousRecords ??
    results.filter((result) => result.nsaStatus === "Suspicious").length;
  const valid = summary.validRecords ?? Math.max(total - suspicious, 0);
  const topAnomaly = results.find(
    (result) => result.nsaStatus === "Suspicious"
  );

  const heroColor = suspicious > 0 ? COLORS.red : COLORS.cyan;
  const stats: Stat[] = [
    { label: "total_records", value: total, color: COLORS.cyanLight },
    { label: "valid", value: valid, color: COLORS.green },
    { label: "suspicious", value: suspicious, color: COLORS.red },
    {
      label: "pass_rate",
      value: total > 0 ? `${Math.round((valid / total) * 100)}%` : "—",
      color: COLORS.purple,
    },
  ];

  return (
    <>
      <HeroBox
        color={heroColor}
        icon={
          suspicious > 0 ? (
            <AlertTriangle size={28} />
          ) : (
            <CheckCircle2 size={28} />
          )
        }
        value={suspicious}
        label={`suspicious_record${suspicious !== 1 ? "s" : ""}_detected`}
      />

      <StatsGrid stats={stats} />

      <InsightBox icon={<BarChart2 size={14} />} title="main_anomaly_pattern">
        {topAnomaly
          ? topAnomaly.anomalyReason
          : "No suspicious patterns detected in this dataset."}
      </InsightBox>

      <InsightBox icon={<CheckCircle2 size={14} />} title="pipeline_status">
        {`${valid} record${valid !== 1 ? "s" : ""} cleared for sentiment analysis. ${
          suspicious > 0
            ? `${suspicious} blocked by the NSA filter.`
            : "All records are valid."
        }`}
      </InsightBox>
    </>
  );
}

function SentimentContent({ summary }: { summary: SentimentSummary }) {
  const dominantLabel: SentimentLabel =
    summary.pos >= summary.neg && summary.pos >= summary.neu
      ? "Positive"
      : summary.neg >= summary.pos && summary.neg >= summary.neu
      ? "Negative"
      : "Neutral";

  const dominantColor = SENTIMENT_COLORS[dominantLabel];
  const stats: Stat[] = [
    { label: "total_records", value: summary.total, color: COLORS.cyanLight },
    { label: "positive", value: summary.pos, color: COLORS.green },
    { label: "negative", value: summary.neg, color: "#ef4444" },
    { label: "neutral", value: summary.neu, color: COLORS.amber },
  ];

  return (
    <>
      <HeroBox
        color={dominantColor}
        icon={SENTIMENT_ICONS[dominantLabel]}
        value={dominantLabel.toLowerCase()}
        label="dominant_sentiment"
      />

      <StatsGrid stats={stats} />

      <InsightBox icon={<CheckCircle2 size={14} />} title="pipeline_status">
        {`${summary.total} record${summary.total !== 1 ? "s" : ""} classified. `}
        {`Positive: ${summary.pos}, negative: ${summary.neg}, neutral: ${summary.neu}.`}
      </InsightBox>

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
    </>
  );
}

function HeroBox({
  color,
  icon,
  value,
  label,
}: {
  color: string;
  icon: ReactNode;
  value: number | string;
  label: string;
}) {
  return (
    <Box
      sx={{
        p: 3,
        mb: 3,
        borderRadius: 3,
        bgcolor: `${color}16`,
        border: `1px solid ${color}55`,
        display: "flex",
        alignItems: "center",
        gap: 2,
        boxShadow: `0 0 24px ${color}18`,
      }}
    >
      <Box sx={{ color, display: "flex" }}>{icon}</Box>
      <Box>
        <Typography
          sx={{
            fontSize: typeof value === "number" ? "2.4rem" : "1.7rem",
            fontWeight: 900,
            lineHeight: 1,
            color,
            fontFamily: "monospace",
          }}
        >
          {value}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: COLORS.secondaryText }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 1.5,
        mb: 3,
      }}
    >
      {stats.map((stat) => (
        <MiniStat key={stat.label} {...stat} />
      ))}
    </Box>
  );
}

function MiniStat({ label, value, color }: Stat) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: COLORS.inner,
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "inset 0 0 18px rgba(15,23,42,0.8)",
      }}
    >
      <Typography
        variant="h6"
        sx={{ fontWeight: 900, color, fontFamily: "monospace" }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: COLORS.secondaryText, fontFamily: "monospace" }}
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
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        mt: 2,
        borderRadius: 3,
        bgcolor: COLORS.inner,
        border: "1px solid rgba(34,211,238,0.18)",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <Box sx={{ color: COLORS.cyan, display: "flex" }}>{icon}</Box>
        <Chip
          label="INSIGHT"
          size="small"
          sx={{
            height: 22,
            fontSize: "0.68rem",
            fontWeight: 900,
            fontFamily: "monospace",
            bgcolor: "rgba(34,211,238,0.12)",
            color: COLORS.cyanLight,
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
          color: COLORS.secondaryText,
          lineHeight: 1.7,
          fontFamily: "monospace",
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}
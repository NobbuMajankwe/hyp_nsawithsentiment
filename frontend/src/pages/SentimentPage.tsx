import {
  Box,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  BrainCircuit,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Zap,
} from "lucide-react";
import { PipelineTracker } from "../components/PipelineTracker";
import { buildSteps } from "../data/pipelineSteps";

export function SentimentPage() {
  return (
    <Box sx={{ py: 4 }}>
      <Container maxWidth={false} sx={{ maxWidth: 1600 }}>
        {/* ── Hero ── */}
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            p: { xs: 3, md: 5 },
            mb: 4,
            borderRadius: 4,
            bgcolor: "#050816",
            color: "#e5e7eb",
            overflow: "hidden",
            border: "1px solid rgba(139,92,246,0.25)",
            boxShadow: "0 0 45px rgba(139,92,246,0.1)",
            backgroundImage: `
      radial-gradient(circle at top right, rgba(139,92,246,0.18), transparent 32%),
      linear-gradient(135deg, #050816 0%, #020617 55%, #111827 100%)
    `,
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.14,
              backgroundImage:
                "linear-gradient(rgba(139,92,246,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.14) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              pointerEvents: "none",
            }}
          />

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", mb: 3 }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: "#020617",
                  border: "1px solid rgba(139,92,246,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 22px rgba(139,92,246,0.28)",
                }}
              >
                <BrainCircuit size={28} color="#a78bfa" />
              </Box>

              <Box>
                <Chip
                  label="$ sentiment_engine --pending"
                  size="small"
                  icon={<Clock size={11} />}
                  sx={{
                    mb: 1,
                    bgcolor: "rgba(139,92,246,0.12)",
                    color: "#c4b5fd",
                    border: "1px solid rgba(139,92,246,0.35)",
                    fontWeight: 800,
                    fontFamily: "monospace",
                    "& .MuiChip-icon": {
                      color: "#c4b5fd",
                    },
                  }}
                />

                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 900,
                    lineHeight: 1,
                    color: "#f8fafc",
                    fontFamily: "monospace",
                    fontSize: { xs: "2rem", md: "3rem" },
                  }}
                >
                  &gt; Sentiment_Analysis
                  <span style={{ color: "#8b5cf6" }}>.</span>
                </Typography>
              </Box>
            </Stack>

            <Typography
              variant="h6"
              sx={{
                maxWidth: 760,
                color: "#94a3b8",
                fontWeight: 400,
                lineHeight: 1.8,
                fontFamily: "monospace",
              }}
            >
              DistilBERT-powered sentiment classification processes only
              verified feedback records that pass through the NSA anomaly
              filter, keeping noisy or suspicious input out of the
              interpretation pipeline.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 3, flexWrap: "wrap" }}
            >
              {[
                "load_valid_records()",
                "classify_sentiment()",
                "queue_insights()",
              ].map((step) => (
                <Chip
                  key={step}
                  label={step}
                  size="small"
                  sx={{
                    bgcolor: "#020617",
                    color: "#ddd6fe",
                    border: "1px solid rgba(139,92,246,0.28)",
                    fontFamily: "monospace",
                    fontWeight: 700,
                  }}
                />
              ))}
            </Stack>

            <Typography
              sx={{
                mt: 4,
                color: "rgba(148,163,184,0.55)",
                fontSize: ".78rem",
                fontFamily: "monospace",
              }}
            >
              STATUS → awaiting sentiment model integration...
            </Typography>
          </Box>
        </Paper>

        {/* ── Pipeline context ── */}
        <PipelineTracker
          subtitle="Step 3 of 4 — after NSA filter"
          steps={buildSteps(2)}
          activeColor="#6366f1"
        />

        {/* ── Feature cards ── */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 3,
          }}
        >
          <FeatureCard
            icon={<Filter size={22} />}
            title="NSA Pre-filtered Input"
            color="#6366f1"
            items={[
              "Only Valid records from Stage 1 reach this stage",
              "Suspicious records are permanently excluded",
              "Clean signal improves model accuracy",
            ]}
          />
          <FeatureCard
            icon={<BrainCircuit size={22} />}
            title="DistilBERT Classifier"
            color="#8b5cf6"
            items={[
              "Lightweight transformer fine-tuned for sentiment",
              "Labels: Positive, Negative, Neutral",
              "Returns confidence score per record",
            ]}
          />
          <FeatureCard
            icon={<Layers size={22} />}
            title="Output Format"
            color="#0891b2"
            items={[
              "Sentiment label per valid record",
              "Confidence percentage (0–100)",
              "Feeds directly into Insight Story stage",
            ]}
          />
        </Box>

        {/* ── Placeholder preview ── */}
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: { xs: 3, md: 4 },
            borderRadius: 5,
            bgcolor: "#050816",
            color: "#e5e7eb",
            border: "1px solid rgba(139,92,246,.18)",
            boxShadow: "0 0 35px rgba(139,92,246,.08)",
            borderColor: "grey.300",
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: "center", mb: 3 }}
          >
            <Zap size={20} color="#6366f1" />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 900,

                fontFamily: "monospace",

                color: "#f8fafc",
              }}
            >
              Preview → sentiment_result_cards()
            </Typography>
            <Chip
              label="$ sentiment_output"
              size="small"
              sx={{
                bgcolor: "rgba(139,92,246,.1)",
                color: "#a78bfa",
                border: "1px solid rgba(139,92,246,.25)",
                fontFamily: "monospace",
              }}
            />
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: 2,
            }}
          >
            {MOCK_CARDS.map((card) => (
              <SentimentMockCard key={card.id} {...card} />
            ))}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeatureCard({
  icon,
  title,
  color,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  items: string[];
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: "#020617",
        border: `1px solid ${color}30`,
        color: "#e5e7eb",
        boxShadow: `0 0 26px ${color}12`,
        transition: ".2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 0 36px ${color}25`,
        },
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: 3,
          bgcolor: "#050816",
          border: `1px solid ${color}40`,
          color,
          boxShadow: `0 0 18px ${color}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          fontWeight: 900,
          mb: 1.5,
          color: "#f8fafc",
          fontFamily: "monospace",
        }}
      >
        {title}
      </Typography>
      <Divider
        sx={{
          mb: 1.5,

          borderColor: "rgba(255,255,255,.06)",
        }}
      />
      <Stack spacing={1}>
        {items.map((item) => (
          <Stack
            key={item}
            direction="row"
            spacing={1}
            sx={{ alignItems: "flex-start" }}
          >
            <CheckCircle2
              size={14}
              color={color}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <Typography
              variant="body2"
              sx={{
                color: "#94a3b8",
                fontFamily: "monospace",
              }}
            >
              {item}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function SentimentMockCard({
  text,
  label,
  confidence,
}: {
  id: number;
  text: string;
  label: string;
  confidence: number;
}) {
  const colors: Record<string, string> = {
    Positive: "#22c55e",
    Negative: "#ef4444",
    Neutral: "#f59e0b",
  };
  /* const bgColors: Record<string, string> = {
    Positive: "rgba(34,197,94,0.06)",
    Negative: "rgba(239,68,68,0.06)",
    Neutral: "rgba(245,158,11,0.06)",
  }; */
  const color = colors[label] ?? "#6b7280";

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: "#020617",
        border: `1px solid ${color}25`,
        boxShadow: `0 0 18px ${color}10`,
        color: "#e5e7eb",
        transition: ".2s",
        "&:hover": {
          transform: "translateY(-3px)",
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{
          mb: 2,
          lineHeight: 1.8,
          fontFamily: "monospace",
          color: "#cbd5e1",
        }}
      >
        "{text}"
      </Typography>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Chip
          label={label}
          size="small"
          sx={{
            fontWeight: 900,
            fontFamily: "monospace",
            bgcolor: `${color}10`,
            border: `1px solid ${color}30`,
            color
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 900,
            fontFamily: "monospace",
            color,
          }}
        >
          {confidence}% confidence
        </Typography>
      </Stack>
      <Typography
        sx={{
          mb: 2,
          fontSize: ".72rem",
          fontFamily: "monospace",
          color: "rgba(148,163,184,.5)",
        }}
      >
        prediction.run()
      </Typography>
    </Paper>
  );
}

const MOCK_CARDS = [
  {
    id: 1,
    text: "The event was well organised and the speakers were informative.",
    label: "Positive",
    confidence: 94,
  },
  {
    id: 2,
    text: "I enjoyed the networking session and the venue was comfortable.",
    label: "Positive",
    confidence: 88,
  },
  {
    id: 3,
    text: "The session started late but the information was clear.",
    label: "Neutral",
    confidence: 71,
  },
  {
    id: 4,
    text: "The workshop was useful and the registration process was smooth.",
    label: "Positive",
    confidence: 91,
  },
  {
    id: 5,
    text: "The panel discussion was helpful and the staff were friendly.",
    label: "Positive",
    confidence: 89,
  },
  {
    id: 6,
    text: "Content was relevant but the schedule could be better managed.",
    label: "Neutral",
    confidence: 65,
  },
];

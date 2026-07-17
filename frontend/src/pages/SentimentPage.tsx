import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Activity,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Database,
  Minus,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Upload,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageLayout } from "../components/PageLayout";
import { PageHero } from "../components/PageHero";
import { PipelineTracker } from "../components/PipelineTracker";
import { buildSteps } from "../data/pipelineSteps";
import { fetchLatestValidRecords, runSentimentAnalysis } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { SentimentItem, SentimentLabel } from "../types";
import { SummaryPanel } from "../components/SummaryPanel";

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

export function SentimentPage() {
  const { token } = useAuth();

  const [nsaTexts, setNsaTexts] = useState<string[]>([]);
  const [nsaInfo, setNsaInfo] = useState<{
    totalRecords: number;
    validRecords: number;
    suspiciousRecords: number;
    createdAt: string;
  } | null>(null);
  const [nsaLoading, setNsaLoading] = useState(false);
  const [nsaError, setNsaError] = useState<string | null>(null);

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideText, setOverrideText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [results, setResults] = useState<SentimentItem[]>([]);
  const [summary, setSummary] = useState<{
    pos: number;
    neg: number;
    neu: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NSA records are primary; manual override is secondary
  const activeTexts =
    nsaTexts.length > 0
      ? nsaTexts
      : overrideText.split("\n").filter((l) => l.trim());

  const usingNsaSource = nsaTexts.length > 0;

  useEffect(() => {
    if (!token) return;
    //setNsaLoading(true);
    fetchLatestValidRecords(token)
      .then((res) => {
        if (res.found && res.records.length > 0) {
          setNsaTexts(res.records.map((r) => r.text));
          setNsaInfo(res.sessionInfo);
        } else {
          setNsaError(
            "No NSA session found. Run NSA Analysis first, or use the manual input below.",
          );
        }
      })
      .catch(() =>
        setNsaError("Could not load NSA results. Run NSA Analysis first."),
      )
      .finally(() => setNsaLoading(false));
  }, [token]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = (e.target?.result as string) ?? "";
      setOverrideText(raw.split("\n").filter(Boolean).join("\n"));
      setNsaTexts([]);
      setNsaInfo(null);
      setNsaError(null);
    };
    reader.readAsText(file);
  }

  async function handleRun() {
    if (activeTexts.length === 0 || !token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await runSentimentAnalysis(activeTexts, token);
      setResults(data.results);
      setSummary({
        pos: data.positiveCount,
        neg: data.negativeCount,
        neu: data.neutralCount,
        total: data.totalRecords,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Backend unreachable.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResults([]);
    setSummary(null);
    setError(null);
    setOverrideText("");
    if (!token) return;
    setNsaLoading(true);
    fetchLatestValidRecords(token)
      .then((res) => {
        if (res.found && res.records.length > 0) {
          setNsaTexts(res.records.map((r) => r.text));
          setNsaInfo(res.sessionInfo);
        }
      })
      .catch(() => {})
      .finally(() => setNsaLoading(false));
  }

  const pieData = summary
    ? [
        { name: "Positive", value: summary.pos, fill: LABEL_COLORS.Positive },
        { name: "Negative", value: summary.neg, fill: LABEL_COLORS.Negative },
        { name: "Neutral", value: summary.neu, fill: LABEL_COLORS.Neutral },
      ].filter((d) => d.value > 0)
    : [];

  const barData = results.map((r) => ({
    name: `#${r.id}`,
    confidence: r.confidence,
    label: r.label,
  }));

  return (
    <PageLayout>
      <PageHero
        icon={<BrainCircuit size={28} color="#a78bfa" />}
        iconColor="#a78bfa"
        badge="$ sentiment_engine --active"
        badgeIcon={<Activity size={11} />}
        title={<>&gt; Sentiment_Classifier<span style={{ color: "#a78bfa" }}>.</span></>}
        description="The sentiment engine classifies NSA-validated feedback as positive, negative, or neutral, assigns a confidence score, and prepares the results for the insight-generation stage."
        chips={[
          "load_valid_records()",
          "tokenize_feedback()",
          "classify_sentiment()",
          "score_confidence()",
        ]}
        statusLine="STATUS -> Sentiment engine online and ready for validated feedback"
      />

      <PipelineTracker
        subtitle={
          results.length === 0
            ? "Step 3 of 4 — ready for sentiment classification"
            : "Step 3 of 4 — classification complete"
        }
        steps={buildSteps(2)}
        activeColor="#6366f1"
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {xs: "1fr", xl: "minmax(0, 1fr) 380px",},
          gap: 3,
          alignItems: "start",
          mt: 3,
        }}
      >
        <Stack spacing={3}>
          {/* NSA source terminal */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 4,
              bgcolor: PANEL_BG,
              color: "#e5e7eb",
              border: `1px solid ${PANEL_BORDER}`,
              boxShadow: "0 0 35px rgba(139,92,246,0.08)",
              fontFamily: "monospace",
            }}
          >
            <Stack spacing={0.7} sx={{ mb: 3 }}>
              <Typography
                sx={{
                  color: SENTIMENT_PURPLE,
                  fontSize: "0.75rem",
                  fontWeight: 900,
                  fontFamily: "monospace",
                }}
              >
                $ cat latest_nsa_session.log
              </Typography>

              <Typography
                variant="h5"
                sx={{
                  fontWeight: 900,
                  color: PRIMARY_TEXT,
                  fontFamily: "monospace",
                }}
              >
                &gt; validated_feedback_buffer
              </Typography>

              <Typography
                sx={{
                  color: SECONDARY_TEXT,
                  lineHeight: 1.7,
                  fontFamily: "monospace",
                }}
              >
                Automatically loaded from the latest NSA scan. Only records
                marked as valid are permitted into the sentiment classifier.
              </Typography>
            </Stack>

            {nsaLoading && (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.22)",
                }}
              >
                <CircularProgress size={16} sx={{ color: SENTIMENT_PURPLE }} />

                <Typography
                  sx={{
                    color: SECONDARY_TEXT,
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                  }}
                >
                  loading_nsa_results...
                </Typography>
              </Stack>
            )}

            {!nsaLoading && nsaError && (
              <Alert
                severity="warning"
                sx={{
                  mb: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(245,158,11,0.10)",
                  color: "#fde68a",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}
              >
                {nsaError}
              </Alert>
            )}

            {!nsaLoading && usingNsaSource && nsaInfo && (
              <Box
                sx={{
                  p: 2.5,
                  mb: 3,
                  borderRadius: 3,
                  bgcolor: INNER_BG,
                  border: "1px solid rgba(34,197,94,0.22)",
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.2}
                  sx={{ alignItems: "center", mb: 2 }}
                >
                  <Database size={16} color="#4ade80" />

                  <Typography
                    sx={{
                      color: "#4ade80",
                      fontWeight: 900,
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                    }}
                  >
                    session.status = "loaded"
                  </Typography>
                </Stack>

                <Stack spacing={1.2}>
                  {[
                    {
                      label: "records_loaded",
                      value: nsaInfo.totalRecords,
                      color: "#67e8f9",
                    },
                    {
                      label: "valid_records",
                      value: nsaInfo.validRecords,
                      color: "#4ade80",
                    },
                    {
                      label: "blocked_records",
                      value: nsaInfo.suspiciousRecords,
                      color: "#f87171",
                    },
                  ].map((metric) => (
                    <Stack
                      key={metric.label}
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
                          fontSize: "0.78rem",
                        }}
                      >
                        {metric.label}
                      </Typography>

                      <Typography
                        sx={{
                          color: metric.color,
                          fontFamily: "monospace",
                          fontWeight: 900,
                        }}
                      >
                        {metric.value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                {nsaInfo.createdAt && (
                  <Typography
                    sx={{
                      display: "block",
                      mt: 1.5,
                      color: MUTED_TEXT,
                      fontFamily: "monospace",
                      fontSize: "0.68rem",
                    }}
                  >
                    session_timestamp:{" "}
                    {new Date(nsaInfo.createdAt).toLocaleString()}
                  </Typography>
                )}
              </Box>
            )}

            {!nsaLoading && usingNsaSource && (
              <Box
                sx={{
                  p: 2,
                  mb: 3,
                  maxHeight: 230,
                  overflowY: "auto",
                  borderRadius: 3,
                  bgcolor: INNER_BG,
                  border: "1px solid rgba(139,92,246,0.18)",

                  "&::-webkit-scrollbar": {
                    width: 7,
                  },

                  "&::-webkit-scrollbar-thumb": {
                    bgcolor: "rgba(139,92,246,0.35)",
                    borderRadius: 99,
                  },
                }}
              >
                <Typography
                  sx={{
                    display: "block",
                    mb: 1.2,
                    color: SENTIMENT_PURPLE,
                    fontWeight: 900,
                    fontFamily: "monospace",
                    fontSize: "0.72rem",
                  }}
                >
                  $ queue.inspect()
                </Typography>

                {nsaTexts.map((text, index) => (
                  <Box
                    key={`${text}-${index}`}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "44px minmax(0, 1fr)",
                      gap: 1,
                      py: 0.8,
                      borderBottom: "1px solid rgba(148,163,184,0.08)",

                      "&:hover": {
                        bgcolor: "rgba(139,92,246,0.04)",
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        color: "#475569",
                        fontFamily: "monospace",
                        fontSize: "0.76rem",
                      }}
                    >
                      {String(index + 1).padStart(3, "0")} &gt;
                    </Typography>

                    <Typography
                      sx={{
                        color: "#cbd5e1",
                        fontFamily: "monospace",
                        fontSize: "0.78rem",
                        lineHeight: 1.6,
                      }}
                    >
                      {text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", md: "center" },
                flexDirection: { xs: "column", md: "row" },
                gap: 2,
              }}
            >
              <Typography
                sx={{
                  color: SECONDARY_TEXT,
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                }}
              >
                buffer.records ={" "}
                <Box
                  component="span"
                  sx={{ color: "#67e8f9", fontWeight: 900 }}
                >
                  {activeTexts.length}
                </Box>{" "}
                · source ={" "}
                <Box
                  component="span"
                  sx={{ color: "#c4b5fd", fontWeight: 900 }}
                >
                  {usingNsaSource ? '"nsa_scan"' : '"manual_override"'}
                </Box>
              </Typography>

              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={loading}
                  startIcon={<RotateCcw size={15} />}
                  sx={{
                    px: 3,
                    borderRadius: 2,
                    color: "#cbd5e1",
                    borderColor: "rgba(148,163,184,0.28)",
                    fontFamily: "monospace",
                    fontWeight: 800,
                    textTransform: "none",

                    "&:hover": {
                      borderColor: "#94a3b8",
                      bgcolor: "rgba(148,163,184,0.06)",
                    },
                  }}
                >
                  reset --session
                </Button>

                <Button
                  variant="contained"
                  onClick={handleRun}
                  disabled={loading || activeTexts.length === 0}
                  startIcon={
                    loading ? (
                      <CircularProgress size={15} color="inherit" />
                    ) : (
                      <Zap size={15} />
                    )
                  }
                  sx={{
                    px: 4,
                    py: 1.2,
                    borderRadius: 2,
                    bgcolor: SENTIMENT_PURPLE,
                    color: "#020617",
                    fontFamily: "monospace",
                    fontWeight: 900,
                    textTransform: "none",
                    boxShadow: "0 0 24px rgba(139,92,246,0.28)",

                    "&:hover": {
                      bgcolor: "#c4b5fd",
                      boxShadow: "0 0 34px rgba(139,92,246,0.40)",
                    },
                  }}
                >
                  {loading ? "classifying..." : "./run_sentiment_analysis"}
                </Button>
              </Stack>
            </Box>
          </Paper>

          {/* Manual override terminal */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: 4,
              bgcolor: PANEL_BG,
              border: `1px solid ${PANEL_BORDER}`,
              overflow: "hidden",
            }}
          >
            <Button
              fullWidth
              onClick={() => setOverrideOpen((open) => !open)}
              endIcon={
                overrideOpen ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )
              }
              sx={{
                p: 2.5,
                borderRadius: 0,
                justifyContent: "space-between",
                color: "#cbd5e1",
                textTransform: "none",
                fontFamily: "monospace",

                "&:hover": {
                  bgcolor: "rgba(139,92,246,0.05)",
                },
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Upload size={16} color="#a78bfa" />

                <Typography
                  sx={{
                    fontWeight: 900,
                    fontFamily: "monospace",
                    fontSize: "0.82rem",
                  }}
                >
                  $ nano manual_input.txt
                </Typography>
              </Stack>
            </Button>

            <Collapse in={overrideOpen}>
              <Divider sx={{ borderColor: "rgba(148,163,184,0.12)" }} />

              <Box sx={{ p: 3 }}>
                <Typography
                  sx={{
                    mb: 2,
                    color: SECONDARY_TEXT,
                    fontFamily: "monospace",
                    fontSize: "0.78rem",
                    lineHeight: 1.7,
                  }}
                >
                  Upload a .txt, .csv or .json file, or enter one feedback
                  record per line to override the current NSA source.
                </Typography>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.csv,.json"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                    event.target.value = "";
                  }}
                />

                <Button
                  variant="outlined"
                  onClick={() => fileRef.current?.click()}
                  startIcon={<Upload size={15} />}
                  sx={{
                    mb: 2,
                    borderRadius: 2,
                    color: "#c4b5fd",
                    borderColor: "rgba(139,92,246,0.35)",
                    fontFamily: "monospace",
                    fontWeight: 800,
                    textTransform: "none",

                    "&:hover": {
                      borderColor: SENTIMENT_PURPLE,
                      bgcolor: "rgba(139,92,246,0.08)",
                    },
                  }}
                >
                  upload_file()
                </Button>

                <TextField
                  multiline
                  fullWidth
                  minRows={6}
                  value={overrideText}
                  onChange={(event) => {
                    setOverrideText(event.target.value);
                    setNsaTexts([]);
                    setNsaInfo(null);
                  }}
                  placeholder={`# one feedback record per line\nThe event was excellent.\nThe session started late.`}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      bgcolor: INNER_BG,
                      color: "#d1fae5",
                      fontFamily: "monospace",

                      "& fieldset": {
                        borderColor: "rgba(139,92,246,0.22)",
                      },

                      "&:hover fieldset": {
                        borderColor: "rgba(139,92,246,0.45)",
                      },

                      "&.Mui-focused fieldset": {
                        borderColor: SENTIMENT_PURPLE,
                        boxShadow: "0 0 18px rgba(139,92,246,0.18)",
                      },

                      "& textarea": {
                        fontSize: 13,
                        lineHeight: 1.8,
                      },
                    },
                  }}
                />
              </Box>
            </Collapse>
          </Paper>

          {/* Results terminal table */}
          {results.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 4,
                bgcolor: PANEL_BG,
                color: "#e5e7eb",
                border: `1px solid ${PANEL_BORDER}`,
                overflow: "hidden",
                boxShadow: "0 0 30px rgba(139,92,246,0.06)",
              }}
            >
              <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                <Typography
                  sx={{
                    color: SENTIMENT_PURPLE,
                    fontFamily: "monospace",
                    fontWeight: 900,
                    fontSize: "0.72rem",
                    mb: 0.5,
                  }}
                >
                  $ classifier.output()
                </Typography>

                <Typography
                  variant="h5"
                  sx={{
                    color: PRIMARY_TEXT,
                    fontFamily: "monospace",
                    fontWeight: 900,
                  }}
                >
                  &gt; classified_records[]
                </Typography>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: INNER_BG }}>
                      {[
                        { label: "id", width: 70 },
                        { label: "feedback_text" },
                        { label: "prediction", width: 150 },
                        { label: "confidence", width: 190 },
                      ].map((heading) => (
                        <TableCell
                          key={heading.label}
                          sx={{
                            width: heading.width,
                            borderColor: "rgba(148,163,184,0.10)",
                            color: "#64748b",
                            fontSize: "0.7rem",
                            fontWeight: 900,
                            fontFamily: "monospace",
                            textTransform: "uppercase",
                          }}
                        >
                          {heading.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {results.map((item, index) => {
                      const color =
                        LABEL_COLORS[item.label as SentimentLabel] ??
                        SENTIMENT_PURPLE;

                      return (
                        <TableRow
                          key={item.id}
                          sx={{
                            bgcolor: PANEL_BG,

                            "& td": {
                              borderColor: "rgba(148,163,184,0.08)",
                            },

                            "&:hover": {
                              bgcolor: "rgba(139,92,246,0.05)",
                            },
                          }}
                        >
                          <TableCell
                            sx={{
                              color: "#64748b",
                              fontFamily: "monospace",
                              fontWeight: 800,
                            }}
                          >
                            {String(index + 1).padStart(3, "0")}
                          </TableCell>

                          <TableCell
                            sx={{
                              maxWidth: 420,
                              py: 1.7,
                              color: "#cbd5e1",
                              fontFamily: "monospace",
                              fontSize: "0.8rem",
                              lineHeight: 1.6,
                            }}
                          >
                            {item.originalText}
                          </TableCell>

                          <TableCell>
                            <Chip
                              icon={
                                <Box sx={{ color, display: "flex" }}>
                                  {LABEL_ICONS[item.label as SentimentLabel]}
                                </Box>
                              }
                              label={item.label.toLowerCase()}
                              size="small"
                              sx={{
                                bgcolor: `${color}12`,
                                color,
                                border: `1px solid ${color}35`,
                                fontWeight: 900,
                                fontFamily: "monospace",
                              }}
                            />
                          </TableCell>

                          <TableCell>
                            <Stack spacing={0.7}>
                              <Typography
                                sx={{
                                  color,
                                  fontSize: "0.72rem",
                                  fontWeight: 900,
                                  fontFamily: "monospace",
                                }}
                              >
                                {item.confidence.toFixed(1)}%
                              </Typography>

                              <LinearProgress
                                variant="determinate"
                                value={item.confidence}
                                sx={{
                                  height: 6,
                                  borderRadius: 99,
                                  bgcolor: "rgba(148,163,184,0.12)",

                                  "& .MuiLinearProgress-bar": {
                                    bgcolor: color,
                                    borderRadius: 99,
                                    boxShadow: `0 0 10px ${color}`,
                                  },
                                }}
                              />
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Analytics terminal */}
          {results.length > 0 && summary && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 4 },
                borderRadius: 4,
                bgcolor: PANEL_BG,
                color: "#e5e7eb",
                border: `1px solid ${PANEL_BORDER}`,
                boxShadow: "0 0 30px rgba(139,92,246,0.06)",
              }}
            >
              <Stack spacing={0.7} sx={{ mb: 3 }}>
                <Typography
                  sx={{
                    color: SENTIMENT_PURPLE,
                    fontWeight: 900,
                    fontFamily: "monospace",
                    fontSize: "0.72rem",
                  }}
                >
                  $ render_sentiment_visuals()
                </Typography>

                <Typography
                  variant="h5"
                  sx={{
                    color: PRIMARY_TEXT,
                    fontWeight: 900,
                    fontFamily: "monospace",
                  }}
                >
                  &gt; sentiment_distribution
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "1fr 1fr",
                  },
                  gap: 3,
                }}
              >
                <ChartTerminal title="label_breakdown">
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={82}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) =>
                          percent !== undefined
                            ? `${name} ${(percent * 100).toFixed(0)}%`
                            : name
                        }
                        labelLine={false}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>

                      <Tooltip content={<DarkTooltip />} />

                      <Legend
                        wrapperStyle={{
                          color: SECONDARY_TEXT,
                          fontFamily: "monospace",
                          fontSize: 11,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartTerminal>

                <ChartTerminal title="confidence_per_record">
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={barData} barSize={18}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(148,163,184,0.14)"
                      />

                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: SECONDARY_TEXT,
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                      />

                      <YAxis
                        domain={[0, 100]}
                        unit="%"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: SECONDARY_TEXT,
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                      />

                      <Tooltip content={<DarkTooltip />} />

                      <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              LABEL_COLORS[entry.label as SentimentLabel] ??
                              SENTIMENT_PURPLE
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartTerminal>
              </Box>
            </Paper>
          )}
        </Stack>

        {/* Summary */}
        <Box
          sx={{
            position: { xl: "sticky" },
            top: 24,
          }}
        >
          <SummaryPanel summary={summary} results={results} />
        </Box>
      </Box>

      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ width: "100%" }}
        >
          {error}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
}



function ChartTerminal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3,
        bgcolor: INNER_BG,
        border: "1px solid rgba(139,92,246,0.18)",
      }}
    >
      <Typography
        sx={{
          mb: 1.5,
          color: "#c4b5fd",
          fontFamily: "monospace",
          fontWeight: 900,
          fontSize: "0.72rem",
        }}
      >
        $ {title}
      </Typography>

      {children}
    </Box>
  );
}

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: {
      label?: string;
    };
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: INNER_BG,
        border: "1px solid rgba(139,92,246,0.30)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
      }}
    >
      {label && (
        <Typography
          sx={{
            color: "#c4b5fd",
            fontFamily: "monospace",
            fontWeight: 900,
            fontSize: "0.72rem",
            mb: 0.5,
          }}
        >
          {label}
        </Typography>
      )}

      {payload.map((entry, index) => (
        <Typography
          key={`${entry.name}-${index}`}
          sx={{
            color: entry.color ?? "#e5e7eb",
            fontFamily: "monospace",
            fontSize: "0.72rem",
          }}
        >
          {entry.name ?? entry.payload?.label ?? "value"}: {entry.value}
        </Typography>
      ))}
    </Box>
  );
}

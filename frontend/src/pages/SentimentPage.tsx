/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, CheckCircle2, Terminal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHero } from "../components/PageHero";
import { buildSteps } from "../data/pipelineSteps";
import { PipelineTracker } from "../components/PipelineTracker";
import {
  listExperiments,
  getResults,
  runSentimentAnalysis,
  type Experiment,
  type ExperimentResult,
  type SentimentLabel,
  type SentimentAnalysisResponse,
} from "../services/api";

// ─── tokens ───────────────────────────────────────────────────────────────────
const BG = "#050816";
const BG2 = "#020617";
const BORDER = "1px solid rgba(34,211,238,0.2)";
const MONO = "monospace";
const FIELD_SX = {
  "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
  "& .MuiInputLabel-root": { color: "#94a3b8" },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "rgba(34,211,238,0.25)",
  },
  "& .MuiSvgIcon-root": { color: "#22d3ee" },
};

const TONE: Record<SentimentLabel, "success" | "error" | "warning"> = {
  Positive: "success",
  Negative: "error",
  Neutral: "warning",
};

function errMsg(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, bgcolor: BG2, borderColor: "rgba(34,211,238,0.2)" }}
    >
      <Typography variant="body2" sx={{ color: "#94a3b8", fontFamily: MONO }}>
        {label}
      </Typography>
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, color: accent ?? "#f8fafc", fontFamily: MONO }}
      >
        {value}
      </Typography>
    </Paper>
  );
}

export default function SentimentPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [experimentsLoading, setExperimentsLoading] = useState(true);
  const [experimentsError, setExperimentsError] = useState("");
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [nsaResults, setNsaResults] = useState<ExperimentResult[]>([]);
  const [nsaLoading, setNsaLoading] = useState(false);
  const [nsaError, setNsaError] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [analysis, setAnalysis] = useState<SentimentAnalysisResponse | null>(
    null,
  );

  const loadExperiments = useCallback(async () => {
    if (!token) return;
    setExperimentsLoading(true);
    setExperimentsError("");
    try {
      const { experiments: list } = await listExperiments(token, {
        limit: 100,
      });
      setExperiments(list.filter((e) => e.status === "COMPLETED"));
    } catch (cause) {
      setExperimentsError(errMsg(cause, "Could not load experiments."));
    } finally {
      setExperimentsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadExperiments();
  }, [loadExperiments]);

  useEffect(() => {
    if (!token || selectedId === "") return;
    let active = true;
    setNsaLoading(true);
    setNsaError("");
    setNsaResults([]);
    setAnalysis(null);
    setRunError("");
    getResults(token, selectedId as number)
      .then(({ results }) => {
        if (active) setNsaResults(results);
      })
      .catch((cause) => {
        if (active)
          setNsaError(errMsg(cause, "Could not load experiment results."));
      })
      .finally(() => {
        if (active) setNsaLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, selectedId]);

  const selfRecords = useMemo(
    () => nsaResults.filter((r) => r.predicted_class === "SELF"),
    [nsaResults],
  );

  async function handleRun() {
    if (!token || selfRecords.length === 0 || running) return;
    setRunning(true);
    setRunError("");
    setAnalysis(null);
    try {
      setAnalysis(
        await runSentimentAnalysis(
          token,
          selfRecords.map((r) => r.original_text as string),
        ),
      );
    } catch (cause) {
      setRunError(errMsg(cause, "Sentiment analysis failed."));
    } finally {
      setRunning(false);
    }
  }

  const selectedExp = experiments.find((e) => e.experiment_id === selectedId);
  const model = analysis?.results[0]?.model ?? "";
  const pipelineStep = analysis ? 2 : selectedId !== "" ? 2 : 1;

  return (
    <Stack spacing={3}>
      <PageHero
        icon={<BrainCircuit size={28} color="#a78bfa" />}
        iconColor="#a78bfa"
        badge="$ sentiment_engine --classify"
        badgeIcon={<BrainCircuit size={11} />}
        title={
          <>
            &gt; Sentiment_Analysis<span style={{ color: "#a78bfa" }}>.</span>
          </>
        }
        description="Select a completed NSA experiment. Feedback classified as SELF (non-anomalous) is sent for sentiment classification."
        chips={[
          "select_experiment()",
          "filter_self_records()",
          "run_classifier()",
        ]}
        statusLine={
          running
            ? "STATUS -> classifying feedback..."
            : analysis
            ? `STATUS -> ${analysis.totalRecords} records classified.`
            : selectedId !== ""
            ? `STATUS -> ${selfRecords.length} SELF record(s) ready.`
            : "STATUS -> awaiting experiment selection..."
        }
      />

      <PipelineTracker
        subtitle="Step 3 of 4 — sentiment classification"
        steps={buildSteps(pipelineStep)}
        activeColor="#a78bfa"
      />

      {/* Step 1: Experiment picker */}
      <Card sx={{ bgcolor: BG, border: BORDER }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip
                label="01"
                size="small"
                sx={{
                  fontFamily: MONO,
                  fontWeight: 900,
                  bgcolor: "rgba(34,211,238,0.12)",
                  color: "#22d3ee",
                  border: "1px solid rgba(34,211,238,0.4)",
                }}
              />
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "#f8fafc" }}
              >
                Select experiment
              </Typography>
            </Stack>

            {experimentsError && (
              <Alert severity="error" onClose={() => setExperimentsError("")}>
                {experimentsError}
              </Alert>
            )}

            {experimentsLoading ? (
              <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                <CircularProgress size={20} sx={{ color: "#22d3ee" }} />
                <Typography sx={{ color: "#94a3b8", fontFamily: MONO }}>
                  Loading experiments…
                </Typography>
              </Stack>
            ) : experiments.length === 0 ? (
              <Alert severity="warning">
                No completed experiments found. Run an NSA experiment first.
              </Alert>
            ) : (
              <FormControl fullWidth size="small" sx={FIELD_SX}>
                <InputLabel id="sent-exp-label">Experiment</InputLabel>
                <Select
                  labelId="sent-exp-label"
                  label="Experiment"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value as number)}
                  sx={{ fontFamily: MONO }}
                >
                  {experiments.map((exp) => (
                    <MenuItem key={exp.experiment_id} value={exp.experiment_id}>
                      #{exp.experiment_id} — {exp.experiment_name}
                      {exp.created_at
                        ? ` (${new Date(exp.created_at).toLocaleDateString()})`
                        : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Step 2: NSA summary */}
      {selectedId !== "" && (
        <Card sx={{ bgcolor: BG, border: BORDER }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Chip
                  label="02"
                  size="small"
                  sx={{
                    fontFamily: MONO,
                    fontWeight: 900,
                    bgcolor: "rgba(167,139,250,0.12)",
                    color: "#a78bfa",
                    border: "1px solid rgba(167,139,250,0.4)",
                  }}
                />
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#f8fafc" }}
                >
                  NSA classification summary
                </Typography>
                {selectedExp && (
                  <Typography
                    variant="body2"
                    sx={{ color: "#64748b", fontFamily: MONO, ml: 1 }}
                  >
                    {selectedExp.experiment_name}
                  </Typography>
                )}
              </Stack>

              {nsaError && (
                <Alert severity="error" onClose={() => setNsaError("")}>
                  {nsaError}
                </Alert>
              )}

              {nsaLoading ? (
                <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                  <CircularProgress size={20} sx={{ color: "#22d3ee" }} />
                  <Typography sx={{ color: "#94a3b8", fontFamily: MONO }}>
                    Loading results…
                  </Typography>
                </Stack>
              ) : (
                !nsaError && (
                  <>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(3, 1fr)",
                        },
                        gap: 1.5,
                      }}
                    >
                      <StatCard
                        label="Total records"
                        value={nsaResults.length}
                      />
                      <StatCard
                        label="SELF (valid)"
                        value={selfRecords.length}
                        accent="#22c55e"
                      />
                      <StatCard
                        label="NON_SELF / OOV"
                        value={nsaResults.length - selfRecords.length}
                        accent="#f87171"
                      />
                    </Box>

                    {selfRecords.length === 0 ? (
                      <Alert severity="warning">
                        No SELF-classified records. Choose a different
                        experiment.
                      </Alert>
                    ) : (
                      <Box
                        sx={{
                          p: 2,
                          bgcolor: BG2,
                          borderRadius: 2,
                          border: "1px solid rgba(34,211,238,0.15)",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center" }}
                        >
                          <CheckCircle2 size={14} color="#22c55e" />
                          <Typography
                            variant="body2"
                            sx={{ color: "#94a3b8", fontFamily: MONO }}
                          >
                            {selfRecords.length} SELF{" "}
                            {selfRecords.length === 1 ? "record" : "records"}{" "}
                            ready for classification.
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                  </>
                )
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Run */}
      {selectedId !== "" &&
        !nsaLoading &&
        !nsaError &&
        selfRecords.length > 0 && (
          <Card sx={{ bgcolor: BG, border: BORDER }}>
            <CardContent>
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Chip
                    label="03"
                    size="small"
                    sx={{
                      fontFamily: MONO,
                      fontWeight: 900,
                      bgcolor: "rgba(167,139,250,0.12)",
                      color: "#a78bfa",
                      border: "1px solid rgba(167,139,250,0.4)",
                    }}
                  />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#f8fafc" }}
                  >
                    Run sentiment analysis
                  </Typography>
                </Stack>

                {runError && (
                  <Alert severity="error" onClose={() => setRunError("")}>
                    {runError}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void handleRun()}
                  disabled={running}
                  sx={{
                    fontFamily: MONO,
                    fontWeight: 700,
                    bgcolor: "#7c3aed",
                    "&:hover": { bgcolor: "#6d28d9" },
                    alignSelf: "flex-start",
                  }}
                >
                  {running
                    ? "$ classifying..."
                    : analysis
                    ? "$ run_again()"
                    : "$ run_sentiment()"}
                </Button>
                {running && (
                  <>
                    <LinearProgress
                      sx={{
                        "& .MuiLinearProgress-bar": { bgcolor: "#a78bfa" },
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ color: "#64748b", fontFamily: MONO }}
                    >
                      First run may take longer while the model loads.
                    </Typography>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

      {/* Results */}
      {analysis && (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" },
              gap: 1.5,
            }}
          >
            <StatCard label="Classified" value={analysis.totalRecords} />
            <StatCard
              label="Positive"
              value={analysis.positiveCount}
              accent="#22c55e"
            />
            <StatCard
              label="Negative"
              value={analysis.negativeCount}
              accent="#f87171"
            />
            <StatCard
              label="Neutral"
              value={analysis.neutralCount}
              accent="#f59e0b"
            />
          </Box>

          {/* Pipeline handoff */}
          <Card
            sx={{
              bgcolor: "#050816",
              border: "1px solid rgba(249,115,22,0.3)",
            }}
          >
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ alignItems: { sm: "center" } }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#f8fafc" }}
                  >
                    Ready for the insight report
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "#94a3b8", mt: 0.5, fontFamily: MONO }}
                  >
                    Generate a narrative with anomaly context, sentiment
                    distribution, and a recommendation.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() =>
                    navigate("/insight", {
                      state: { experimentId: selectedId },
                    })
                  }
                  sx={{
                    bgcolor: "#ea580c",
                    "&:hover": { bgcolor: "#c2410c" },
                    fontFamily: MONO,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Generate insight report →
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Table */}
          <Card sx={{ bgcolor: BG, border: BORDER, overflow: "hidden" }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <Terminal size={16} color="#a78bfa" />
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#f8fafc" }}
                  >
                    Classified feedback
                  </Typography>
                </Stack>
                {model && (
                  <Typography
                    variant="body2"
                    sx={{ color: "#64748b", fontFamily: MONO }}
                  >
                    model: {model}
                  </Typography>
                )}
                <Divider sx={{ borderColor: "rgba(167,139,250,0.2)" }} />
              </Stack>
            </CardContent>
            <TableContainer>
              <Table
                size="small"
                aria-label="Sentiment classification results"
                sx={{ bgcolor: BG2 }}
              >
                <TableHead>
                  <TableRow>
                    {["#", "Feedback", "Sentiment", "Confidence"].map((h) => (
                      <TableCell
                        key={h}
                        sx={{
                          color: "#94a3b8",
                          fontWeight: 700,
                          fontFamily: MONO,
                          borderBottom: "1px solid rgba(148,163,184,0.18)",
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analysis.results.map((result) => (
                    <TableRow
                      key={result.id}
                      sx={{ "&:hover": { bgcolor: "rgba(167,139,250,0.05)" } }}
                    >
                      <TableCell
                        sx={{
                          width: 72,
                          color: "#64748b",
                          fontFamily: MONO,
                          borderBottom: "1px solid rgba(148,163,184,0.1)",
                        }}
                      >
                        {result.id}
                      </TableCell>
                      <TableCell
                        sx={{
                          minWidth: 220,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                          color: "#cbd5e1",
                          borderBottom: "1px solid rgba(148,163,184,0.1)",
                        }}
                      >
                        {result.originalText}
                      </TableCell>
                      <TableCell
                        sx={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}
                      >
                        <Chip
                          size="small"
                          label={result.label}
                          color={TONE[result.label]}
                          sx={{ fontFamily: MONO, fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "#67e8f9",
                          fontFamily: MONO,
                          borderBottom: "1px solid rgba(148,163,184,0.1)",
                        }}
                      >
                        {result.confidence.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ px: 2, py: 1.5, bgcolor: BG2 }}>
              <Typography
                variant="caption"
                sx={{ color: "#475569", fontFamily: MONO }}
              >
                Confidence is the softmax score for the selected class; not a
                calibrated probability.
              </Typography>
            </Box>
          </Card>
        </>
      )}
    </Stack>
  );
}

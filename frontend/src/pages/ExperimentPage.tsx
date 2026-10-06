import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import { Link, useParams } from "react-router-dom";
import { FlaskConical, Terminal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHero } from "../components/PageHero";
import { getDetectors, getResults, getSummary } from "../services/api";

// ─── tokens ──────────────────────────────────────────────────────────────────
const BG    = "#050816";
const BG2   = "#020617";
const BORDER = "1px solid rgba(34,211,238,0.2)";
const MONO  = "monospace";

// ─── helpers ─────────────────────────────────────────────────────────────────
type Row    = Record<string, unknown>;
type Column = { label: string; keys: string[]; numeric?: boolean };

function object(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row) : {};
}
function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const r = Number(value);
  return Number.isFinite(r) ? r : null;
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function decimal(value: unknown): string {
  const r = number(value);
  return r === null ? "N/A" : r.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function pick(row: Row, keys: string[]): unknown {
  for (const k of keys)
    if (Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  return undefined;
}
function msg(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load experiment data.";
}

const predictionColumns: Column[] = [
  { label: "Record",   keys: ["record_index", "recordIndex", "id"] },
  { label: "Feedback", keys: ["original_text", "originalText", "text"] },
  { label: "Ground truth", keys: ["ground_truth_label", "groundTruthLabel"] },
  { label: "Prediction",   keys: ["predicted_class", "predictedClass"] },
  { label: "Nearest self dist.",     keys: ["nearest_self_distance", "nearestSelfDistance"],     numeric: true },
  { label: "Nearest detector dist.", keys: ["nearest_detector_distance", "nearestDetectorDistance"], numeric: true },
  { label: "Matched detector", keys: ["matched_detector_id", "matchedDetectorId"] },
  { label: "Reason",   keys: ["classification_reason", "classificationReason"] },
];
const detectorColumns: Column[] = [
  { label: "Detector ID", keys: ["detector_id", "detectorId"] },
  { label: "Index",       keys: ["detector_index", "detectorIndex"] },
  { label: "Radius",      keys: ["radius"], numeric: true },
  { label: "Min self dist.", keys: ["minimum_self_distance", "minimumSelfDistance"], numeric: true },
];

// ─── sub-components ───────────────────────────────────────────────────────────
function ValuesCard({ title, items }: { title: string; items: [string, unknown][] }) {
  return (
    <Card sx={{ bgcolor: BG, border: BORDER }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
          <Terminal size={14} color="#22d3ee" />
          <Typography sx={{ fontWeight: 700, color: "#f8fafc", fontFamily: MONO }}>
            $ {title.toLowerCase().replace(/ /g, "_")}
          </Typography>
        </Stack>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
          {items.map(([label, value]) => (
            <Box key={label}>
              <Typography variant="body2" sx={{ color: "#64748b", fontFamily: MONO, mb: 0.25 }}>{label}</Typography>
              <Typography sx={{ fontWeight: 700, color: "#67e8f9", fontFamily: MONO }}>{decimal(value)}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function RecordsTable({ title, rows, columns }: { title: string; rows: Row[]; columns: Column[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  return (
    <Card sx={{ bgcolor: BG, border: BORDER, overflow: "hidden" }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Terminal size={14} color="#22d3ee" />
          <Typography sx={{ fontWeight: 700, color: "#f8fafc", fontFamily: MONO }}>
            $ {title.toLowerCase()} ({rows.length})
          </Typography>
        </Stack>
      </CardContent>
      {rows.length === 0 ? (
        <Typography sx={{ px: 3, pb: 3, color: "#64748b", fontFamily: MONO }}>No records returned.</Typography>
      ) : (
        <>
          <TableContainer>
            <Table size="small" aria-label={title} sx={{ bgcolor: BG2 }}>
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell key={col.label} sx={{ color: "#94a3b8", fontWeight: 700, fontFamily: MONO, borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(page * pageSize, (page + 1) * pageSize).map((row, i) => (
                  <TableRow key={page * pageSize + i} sx={{ "&:hover": { bgcolor: "rgba(34,211,238,0.04)" } }}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.label}
                        sx={{
                          minWidth: col.label === "Feedback" ? 260 : 100,
                          verticalAlign: "top", overflowWrap: "anywhere",
                          color: col.numeric ? "#67e8f9" : "#cbd5e1",
                          fontFamily: MONO, fontSize: "0.82rem",
                          borderBottom: "1px solid rgba(148,163,184,0.1)",
                        }}
                      >
                        {col.numeric ? decimal(pick(row, col.keys)) : display(pick(row, col.keys))}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div" count={rows.length} page={page}
            rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50]}
            sx={{
              bgcolor: BG2, color: "#94a3b8", fontFamily: MONO,
              "& .MuiSvgIcon-root": { color: "#22d3ee" },
              "& .MuiIconButton-root": { color: "#22d3ee" },
              "& .Mui-disabled": { color: "#475569 !important" },
            }}
            onPageChange={(_, next) => setPage(next)}
            onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          />
        </>
      )}
    </Card>
  );
}

function LoadSection({ error, children }: { error: string; children: ReactNode }) {
  return error ? <Alert severity="error">{error}</Alert> : <>{children}</>;
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function ExperimentPage() {
  const { experimentId } = useParams();
  const id = Number(experimentId);
  const validId = /^\d+$/.test(experimentId || "") && Number.isSafeInteger(id) && id > 0;
  const { token } = useAuth();
  const [summary, setSummary]     = useState<Row | null>(null);
  const [results, setResults]     = useState<Row[]>([]);
  const [detectors, setDetectors] = useState<Row[]>([]);
  const [errors, setErrors]       = useState({ summary: "", results: "", detectors: "" });
  const [loading, setLoading]     = useState(true);
  const [revision, setRevision]   = useState(0);

  useEffect(() => {
    if (!token || !validId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSummary(null); setResults([]); setDetectors([]);
    setErrors({ summary: "", results: "", detectors: "" });
    Promise.allSettled([
      getSummary(token, id),
      getResults(token, id),
      getDetectors(token, id),
    ]).then(([s, r, d]) => {
      if (!active) return;
      if (s.status === "fulfilled") setSummary(s.value);
      if (r.status === "fulfilled") setResults(r.value.results);
      if (d.status === "fulfilled") setDetectors(d.value.detectors);
      setErrors({
        summary:   s.status === "rejected" ? msg(s.reason) : "",
        results:   r.status === "rejected" ? msg(r.reason) : "",
        detectors: d.status === "rejected" ? msg(d.reason) : "",
      });
      setLoading(false);
    });
    return () => { active = false; };
  }, [token, id, validId, revision]);

  if (!validId) return <Alert severity="error">Invalid experiment ID.</Alert>;
  if (!token)   return <Alert severity="warning">Sign in to view this experiment.</Alert>;

  const experiment    = object(summary?.experiment);
  const classification = object(summary?.classification);
  const parameters    = object(summary?.parameters);
  const metrics       = object(summary?.metrics);
  const confusion     = object(summary?.confusionMatrix);
  const performance   = object(summary?.performance);
  const generation    = object(summary?.detectorGeneration);
  const featureSpace  = object(summary?.featureSpace);
  const hasConfusion  = ["tp", "tn", "fp", "fn"].every((k) => number(confusion[k]) !== null);
  const requested     = number(parameters.detectorCount);
  const generated     = number(parameters.generatedDetectors);

  return (
    <Stack spacing={3}>
      <PageHero
        icon={<FlaskConical size={28} color="#22d3ee" />}
        iconColor="#22d3ee"
        badge={`$ experiment_${id} --results`}
        badgeIcon={<FlaskConical size={11} />}
        title={
          <>
            &gt; {experiment.name ? display(experiment.name) : `Experiment_${id}`}
            <span style={{ color: "#22d3ee" }}>.</span>
          </>
        }
        description={`Detailed results for NSA experiment #${id}. Review classification metrics, confusion matrix, and per-record predictions.`}
        chips={["view_metrics()", "view_predictions()", "view_detectors()"]}
        statusLine={
          loading
            ? "STATUS -> loading experiment data..."
            : `STATUS -> experiment #${id} · ${display(experiment.status)}`
        }
      />

      {/* Header actions */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
        {experiment.status != null && (
          <Chip
            label={display(experiment.status)}
            sx={{
              fontFamily: MONO, fontWeight: 700,
              bgcolor: experiment.status === "COMPLETED" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.12)",
              color:   experiment.status === "COMPLETED" ? "#86efac" : "#94a3b8",
              border:  `1px solid ${experiment.status === "COMPLETED" ? "rgba(74,222,128,0.35)" : "rgba(148,163,184,0.3)"}`,
            }}
          />
        )}
        <Button
          onClick={() => setRevision((v) => v + 1)} disabled={loading}
          sx={{ fontFamily: MONO, color: "#22d3ee", borderColor: "rgba(34,211,238,0.4)" }}
          variant="outlined"
        >
          Refresh
        </Button>
        <Button
          component={Link} to="/nsa" variant="outlined"
          sx={{ fontFamily: MONO, borderColor: "rgba(34,211,238,0.4)", color: "#22d3ee" }}
        >
          New experiment
        </Button>
      </Stack>

      {loading ? (
        <CircularProgress aria-label="Loading experiment" sx={{ color: "#22d3ee" }} />
      ) : (
        <>
          <LoadSection error={errors.summary}>
            {summary && (
              <>
                {requested !== null && generated !== null && generated < requested && (
                  <Alert severity="warning">
                    Generated {generated} of {requested} requested detectors. Check generation attempts when comparing this run.
                  </Alert>
                )}

                <ValuesCard
                  title="Classification"
                  items={[
                    ["Total records", classification.total],
                    ["SELF", classification.self],
                    ["NON_SELF", classification.nonSelf],
                    ["OOV", classification.oov],
                  ]}
                />

                {/* Confusion matrix */}
                <Card sx={{ bgcolor: BG, border: BORDER }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                      <Terminal size={14} color="#22d3ee" />
                      <Typography sx={{ fontWeight: 700, color: "#f8fafc", fontFamily: MONO }}>
                        $ confusion_matrix
                      </Typography>
                    </Stack>
                    {hasConfusion ? (
                      <>
                        <Typography variant="body2" sx={{ color: "#64748b", fontFamily: MONO, mb: 2 }}>
                          NON_SELF is the positive class. OOV records are reported separately.
                        </Typography>
                        <TableContainer>
                          <Table size="small" aria-label="Confusion matrix" sx={{ bgcolor: BG2 }}>
                            <TableHead>
                              <TableRow>
                                {["Actual / Predicted", "NON_SELF", "SELF"].map((h) => (
                                  <TableCell key={h} sx={{ color: "#94a3b8", fontFamily: MONO, fontWeight: 700, borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
                                    {h}
                                  </TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ color: "#94a3b8", fontFamily: MONO, borderBottom: "1px solid rgba(148,163,184,0.1)" }}>NON_SELF</TableCell>
                                <TableCell sx={{ color: "#22c55e", fontFamily: MONO, borderBottom: "1px solid rgba(148,163,184,0.1)" }}>TP: {decimal(confusion.tp)}</TableCell>
                                <TableCell sx={{ color: "#f87171", fontFamily: MONO, borderBottom: "1px solid rgba(148,163,184,0.1)" }}>FN: {decimal(confusion.fn)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ color: "#94a3b8", fontFamily: MONO, borderBottom: "none" }}>SELF</TableCell>
                                <TableCell sx={{ color: "#f87171", fontFamily: MONO, borderBottom: "none" }}>FP: {decimal(confusion.fp)}</TableCell>
                                <TableCell sx={{ color: "#22d3ee", fontFamily: MONO, borderBottom: "none" }}>TN: {decimal(confusion.tn)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    ) : (
                      <Typography sx={{ color: "#64748b", fontFamily: MONO }}>
                        No confusion matrix returned. Labelled evaluation data is required.
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                <ValuesCard
                  title="Evaluation metrics (ratios)"
                  items={[
                    ["Accuracy",             metrics.accuracy],
                    ["Precision",            metrics.precision],
                    ["Recall / detection rate", metrics.recall],
                    ["Specificity",          metrics.specificity],
                    ["F1 score",             metrics.f1Score],
                    ["False alarm rate",     metrics.falseAlarmRate],
                    ["False negative rate",  metrics.falseNegativeRate],
                  ]}
                />
                <ValuesCard
                  title="Run parameters"
                  items={[
                    ["Requested detectors", parameters.detectorCount],
                    ["Generated detectors", parameters.generatedDetectors],
                    ["Detector radius",     parameters.detectorRadius],
                    ["Self match threshold", parameters.selfMatchThreshold],
                    ["Maximum attempts",    parameters.maxAttempts],
                    ["Random seed",         parameters.randomSeed],
                  ]}
                />
                <ValuesCard
                  title="Training and execution"
                  items={[
                    ["Vocabulary size",     featureSpace.vocabularySize],
                    ["Self corpus size",    featureSpace.selfCorpusSize],
                    ["Generation attempts", generation.attempts],
                    ["Acceptance rate",     generation.acceptanceRate],
                    ["Training (ms)",       performance.trainingTimeMs],
                    ["Detection (ms)",      performance.detectionTimeMs],
                    ["Total execution (ms)", performance.totalExecutionTimeMs],
                  ]}
                />
              </>
            )}
          </LoadSection>

          <LoadSection error={errors.results}>
            <RecordsTable
              key={`results-${id}-${revision}`}
              title="Predictions"
              rows={results}
              columns={predictionColumns}
            />
          </LoadSection>

          <LoadSection error={errors.detectors}>
            <RecordsTable
              key={`detectors-${id}-${revision}`}
              title="Generated detectors"
              rows={detectors}
              columns={detectorColumns}
            />
          </LoadSection>
        </>
      )}
    </Stack>
  );
}

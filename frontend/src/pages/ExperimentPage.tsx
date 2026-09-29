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
import { useAuth } from "../context/AuthContext";
import { getDetectors, getResults, getSummary } from "../services/api";

type Row = Record<string, unknown>;
type Column = { label: string; keys: string[]; numeric?: boolean };
function object(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}
function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function decimal(value: unknown): string {
  const result = number(value);
  return result === null
    ? "N/A"
    : result.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function pick(row: Row, keys: string[]): unknown {
  for (const key of keys)
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  return undefined;
}
function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not load experiment data.";
}

const predictionColumns: Column[] = [
  { label: "Record", keys: ["record_index", "recordIndex", "id"] },
  { label: "Feedback", keys: ["original_text", "originalText", "text"] },
  { label: "Ground truth", keys: ["ground_truth_label", "groundTruthLabel"] },
  { label: "Prediction", keys: ["predicted_class", "predictedClass"] },
  {
    label: "Nearest self distance",
    keys: ["nearest_self_distance", "nearestSelfDistance"],
    numeric: true,
  },
  {
    label: "Nearest detector distance",
    keys: ["nearest_detector_distance", "nearestDetectorDistance"],
    numeric: true,
  },
  {
    label: "Matched detector",
    keys: ["matched_detector_id", "matchedDetectorId"],
  },
  { label: "Reason", keys: ["classification_reason", "classificationReason"] },
];
const detectorColumns: Column[] = [
  { label: "Detector ID", keys: ["detector_id", "detectorId"] },
  { label: "Index", keys: ["detector_index", "detectorIndex"] },
  { label: "Radius", keys: ["radius"], numeric: true },
  {
    label: "Minimum self distance",
    keys: ["minimum_self_distance", "minimumSelfDistance"],
    numeric: true,
  },
];

function Values({
  title,
  items,
}: {
  title: string;
  items: [string, unknown][];
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {items.map(([label, value]) => (
            <Box key={label}>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
              <Typography sx={{fontWeight:600}}>{decimal(value)}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function RecordsTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Row[];
  columns: Column[];
}) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">
          {title} ({rows.length})
        </Typography>
      </CardContent>
      {rows.length === 0 ? (
        <Typography sx={{ px: 2, pb: 2 }} color="text.secondary">
          No records returned.
        </Typography>
      ) : (
        <>
          <TableContainer>
            <Table size="small" aria-label={title}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.label}>{column.label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows
                  .slice(page * pageSize, (page + 1) * pageSize)
                  .map((row, index) => (
                    <TableRow key={page * pageSize + index}>
                      {columns.map((column) => (
                        <TableCell
                          key={column.label}
                          sx={{
                            minWidth: column.label === "Feedback" ? 260 : 100,
                            verticalAlign: "top",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {column.numeric
                            ? decimal(pick(row, column.keys))
                            : display(pick(row, column.keys))}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={rows.length}
            page={page}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            onPageChange={(_, next) => setPage(next)}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
          />
        </>
      )}
    </Card>
  );
}

function LoadSection({
  error,
  children,
}: {
  error: string;
  children: ReactNode;
}) {
  return error ? <Alert severity="error">{error}</Alert> : <>{children}</>;
}

export default function ExperimentPage() {
  const { experimentId } = useParams();
  const id = Number(experimentId);
  const validId =
    /^\d+$/.test(experimentId || "") && Number.isSafeInteger(id) && id > 0;
  const { token } = useAuth();
  const [summary, setSummary] = useState<Row | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [detectors, setDetectors] = useState<Row[]>([]);
  const [errors, setErrors] = useState({
    summary: "",
    results: "",
    detectors: "",
  });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!token || !validId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSummary(null);
    setResults([]);
    setDetectors([]);
    setErrors({ summary: "", results: "", detectors: "" });
    Promise.allSettled([
      getSummary(token, id),
      getResults(token, id),
      getDetectors(token, id),
    ]).then(([summaryResponse, resultsResponse, detectorsResponse]) => {
      if (!active) return;
      if (summaryResponse.status === "fulfilled")
        setSummary(summaryResponse.value);
      if (resultsResponse.status === "fulfilled")
        setResults(resultsResponse.value.results);
      if (detectorsResponse.status === "fulfilled")
        setDetectors(detectorsResponse.value.detectors);
      setErrors({
        summary:
          summaryResponse.status === "rejected"
            ? message(summaryResponse.reason)
            : "",
        results:
          resultsResponse.status === "rejected"
            ? message(resultsResponse.reason)
            : "",
        detectors:
          detectorsResponse.status === "rejected"
            ? message(detectorsResponse.reason)
            : "",
      });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token, id, validId, revision]);

  if (!validId) return <Alert severity="error">Invalid experiment ID.</Alert>;
  if (!token)
    return <Alert severity="warning">Sign in to view this experiment.</Alert>;
  const experiment = object(summary?.experiment);
  const classification = object(summary?.classification);
  const parameters = object(summary?.parameters);
  const metrics = object(summary?.metrics);
  const confusion = object(summary?.confusionMatrix);
  const performance = object(summary?.performance);
  const generation = object(summary?.detectorGeneration);
  const featureSpace = object(summary?.featureSpace);
  const hasConfusion = ["tp", "tn", "fp", "fn"].every(
    (key) => number(confusion[key]) !== null,
  );
  const requested = number(parameters.detectorCount);
  const generated = number(parameters.generatedDetectors);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{alignItems:{ sm: "center" }}}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{fontWeight:700}}>
            {experiment.name ? display(experiment.name) : `Experiment #${id}`}
          </Typography>
          <Typography color="text.secondary">Experiment #{id}</Typography>
        </Box>
        {experiment.status != null && (
          <Chip label={display(experiment.status)} />
        )}
        <Button
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          Refresh
        </Button>
        <Button component={Link} to="/nsa" variant="outlined">
          New experiment
        </Button>
      </Stack>
      {loading ? (
        <CircularProgress aria-label="Loading experiment" />
      ) : (
        <>
          <LoadSection error={errors.summary}>
            {summary && (
              <>
                {requested !== null &&
                  generated !== null &&
                  generated < requested && (
                    <Alert severity="warning">
                      Generated {generated} of {requested} requested detectors.
                      Check generation attempts when comparing this run.
                    </Alert>
                  )}
                <Values
                  title="Classification"
                  items={[
                    ["Total records", classification.total],
                    ["SELF", classification.self],
                    ["NON_SELF", classification.nonSelf],
                    ["Out of vocabulary (OOV)", classification.oov],
                  ]}
                />
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Confusion matrix
                    </Typography>
                    {hasConfusion ? (
                      <>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                        >
                          NON_SELF is the positive class. OOV records are
                          reported separately in the classification totals.
                        </Typography>
                        <TableContainer>
                          <Table size="small" aria-label="Confusion matrix">
                            <TableHead>
                              <TableRow>
                                <TableCell>Actual / Predicted</TableCell>
                                <TableCell>NON_SELF</TableCell>
                                <TableCell>SELF</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell>NON_SELF</TableCell>
                                <TableCell>
                                  TP: {decimal(confusion.tp)}
                                </TableCell>
                                <TableCell>
                                  FN: {decimal(confusion.fn)}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>SELF</TableCell>
                                <TableCell>
                                  FP: {decimal(confusion.fp)}
                                </TableCell>
                                <TableCell>
                                  TN: {decimal(confusion.tn)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    ) : (
                      <Typography color="text.secondary">
                        No confusion matrix was returned. Labelled evaluation
                        data is required.
                      </Typography>
                    )}
                  </CardContent>
                </Card>
                <Values
                  title="Evaluation metrics (ratios)"
                  items={[
                    ["Accuracy", metrics.accuracy],
                    ["Precision", metrics.precision],
                    ["Recall / detection rate", metrics.recall],
                    ["Specificity", metrics.specificity],
                    ["F1 score", metrics.f1Score],
                    ["False alarm rate", metrics.falseAlarmRate],
                    ["False negative rate", metrics.falseNegativeRate],
                  ]}
                />
                <Values
                  title="Run parameters"
                  items={[
                    ["Requested detectors", parameters.detectorCount],
                    ["Generated detectors", parameters.generatedDetectors],
                    ["Detector radius", parameters.detectorRadius],
                    ["Self match threshold", parameters.selfMatchThreshold],
                    ["Maximum attempts", parameters.maxAttempts],
                    ["Random seed", parameters.randomSeed],
                  ]}
                />
                <Values
                  title="Training and execution"
                  items={[
                    ["Vocabulary size", featureSpace.vocabularySize],
                    ["Self corpus size", featureSpace.selfCorpusSize],
                    ["Generation attempts", generation.attempts],
                    ["Acceptance rate (ratio)", generation.acceptanceRate],
                    ["Training (ms)", performance.trainingTimeMs],
                    ["Detection (ms)", performance.detectionTimeMs],
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

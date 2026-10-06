import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { BarChart2, FlaskConical, Database, Terminal } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PageHero } from "../components/PageHero";
import { buildSteps } from "../data/pipelineSteps";
import { PipelineTracker } from "../components/PipelineTracker";
import {
  listDatasets,
  listExperiments,
  type Dataset,
  type Experiment,
} from "../services/api";

// ─── design tokens ───────────────────────────────────────────────────────────
const BG = "#050816";
const BG2 = "#020617";
const BORDER = "1px solid rgba(34,211,238,0.2)";
const MONO = "monospace";

// ─── helpers ─────────────────────────────────────────────────────────────────
function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not load data. Please try again.";
}
function numeric(value: unknown): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value !== "string" && typeof value !== "number") return "N/A";
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : "N/A";
}
function date(value: unknown): string {
  if (typeof value !== "string") return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
}
function statusColor(
  status: string,
): "success" | "error" | "info" | "default" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "error";
  if (status === "RUNNING") return "info";
  return "default";
}

// ─── stat card ────────────────────────────────────────────────────────────────
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
    <Card
      sx={{
        bgcolor: BG,
        border: BORDER,
        boxShadow: "0 0 24px rgba(34,211,238,0.06)",
      }}
    >
      <CardContent>
        <Typography
          variant="body2"
          sx={{ color: "#94a3b8", fontFamily: MONO, mb: 0.5 }}
        >
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{ mt: 0.5, fontWeight: 900, color: accent ?? "#22d3ee", fontFamily: MONO }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, token } = useAuth();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [errors, setErrors] = useState({ datasets: "", experiments: "" });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!token) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setDatasets([]);
    setExperiments([]);
    setPage(0);
    setErrors({ datasets: "", experiments: "" });
    Promise.allSettled([listDatasets(token), listExperiments(token)]).then(
      ([data, runs]) => {
        if (!active) return;
        if (data.status === "fulfilled") setDatasets(data.value.datasets);
        if (runs.status === "fulfilled") setExperiments(runs.value.experiments);
        setErrors({
          datasets: data.status === "rejected" ? message(data.reason) : "",
          experiments:
            runs.status === "rejected" ? message(runs.reason) : "",
        });
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [token, revision]);

  const filtered = useMemo(
    () =>
      experiments.filter((e) => {
        const q = search.trim().toLowerCase();
        return (
          (status === "ALL" || e.status === status) &&
          (!q ||
            (e.experiment_name || "").toLowerCase().includes(q) ||
            String(e.experiment_id).includes(q))
        );
      }),
    [experiments, search, status],
  );

  const selfCorpora = datasets.filter((d) => d.researchRole === "SELF_CORPUS");
  const evaluationData = datasets.filter((d) => d.researchRole === "EVALUATION");
  const analysisData = datasets.filter((d) => d.researchRole === "ANALYSIS");
  const completed = experiments.filter((e) => e.status === "COMPLETED").length;
  const failed = experiments.filter((e) => e.status === "FAILED").length;

  // Which pipeline step are we at?
  const pipelineStep =
    completed > 0 ? 1 : selfCorpora.length > 0 ? 1 : 0;

  if (!token)
    return (
      <Alert severity="warning">Sign in to open the research dashboard.</Alert>
    );

  return (
    <Stack spacing={3}>
      <PageHero
        icon={<BarChart2 size={28} color="#22d3ee" />}
        iconColor="#22d3ee"
        badge="$ dashboard --overview"
        badgeIcon={<Terminal size={11} />}
        title={<>&gt; Dashboard<span style={{ color: "#22d3ee" }}>.</span></>}
        description={
          user?.fullName
            ? `Welcome back, ${user.fullName}. Review your datasets and NSA experiment history.`
            : "Review your datasets and NSA experiment history below."
        }
        chips={["list_datasets()", "list_experiments()", "view_metrics()"]}
        statusLine={
          loading
            ? "STATUS -> loading workspace data..."
            : `STATUS -> ${datasets.length} dataset(s), ${experiments.length} experiment(s) loaded.`
        }
      />

      <PipelineTracker
        subtitle="Pipeline overview"
        steps={buildSteps(pipelineStep)}
        activeColor="#22d3ee"
      />

      {/* Actions */}
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button
          variant="contained"
          component={Link}
          to="/nsa"
          startIcon={<FlaskConical size={16} />}
          sx={{ bgcolor: "#0e7490", "&:hover": { bgcolor: "#0891b2" } }}
        >
          Run experiment
        </Button>
        <Button
          variant="outlined"
          component={Link}
          to="/datasets"
          startIcon={<Database size={16} />}
          sx={{ borderColor: "rgba(34,211,238,0.4)", color: "#22d3ee" }}
        >
          Manage datasets
        </Button>
        <Button
          onClick={() => setRevision((v) => v + 1)}
          disabled={loading}
          sx={{ color: "#94a3b8", borderColor: "rgba(148,163,184,0.3)" }}
          variant="outlined"
        >
          Refresh
        </Button>
      </Stack>

      {loading ? (
        <CircularProgress aria-label="Loading dashboard" sx={{ color: "#22d3ee" }} />
      ) : (
        <>
          {errors.datasets && (
            <Alert severity="error">Datasets: {errors.datasets}</Alert>
          )}
          {errors.experiments && (
            <Alert severity="error">Experiments: {errors.experiments}</Alert>
          )}

          {/* Stat cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            <StatCard
              label="SELF corpora"
              value={errors.datasets ? "N/A" : selfCorpora.length}
              accent="#22d3ee"
            />
            <StatCard
              label="Evaluation datasets"
              value={errors.datasets ? "N/A" : evaluationData.length}
              accent="#a78bfa"
            />
            <StatCard
              label="Completed experiments"
              value={errors.experiments ? "N/A" : completed}
              accent="#22c55e"
            />
            <StatCard
              label="Failed experiments"
              value={errors.experiments ? "N/A" : failed}
              accent="#f87171"
            />
          </Box>

          {/* Data prep card */}
          {!errors.datasets && (
            <Card sx={{ bgcolor: BG, border: BORDER }}>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#f8fafc", mb: 1.5 }}
                >
                  Data preparation
                </Typography>
                <Stack spacing={1.5}>
                  <Typography sx={{ color: "#94a3b8", fontFamily: MONO, fontSize: "0.9rem" }}>
                    Use a SELF corpus for training and a separate labelled
                    evaluation dataset to measure performance.
                  </Typography>
                  <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
                    {[
                      `SELF corpus: ${selfCorpora.length ? "available" : "not found"}`,
                      `Evaluation datasets: ${evaluationData.length}`,
                      `Analysis datasets: ${analysisData.length}`,
                    ].map((label) => (
                      <Chip
                        key={label}
                        label={label}
                        size="small"
                        sx={{
                          fontFamily: MONO,
                          bgcolor: "rgba(34,211,238,0.08)",
                          color: "#67e8f9",
                          border: "1px solid rgba(34,211,238,0.3)",
                        }}
                      />
                    ))}
                  </Stack>
                  {!datasets.length && (
                    <Alert severity="info">
                      Start by uploading your training and evaluation datasets.
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Experiment history */}
          {!errors.experiments && (
            <Card sx={{ bgcolor: BG, border: BORDER, overflow: "hidden" }}>
              <CardContent>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: "#f8fafc", mb: 2 }}
                >
                  Experiment history
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                >
                  <TextField
                    label="Search name or ID"
                    size="small"
                    value={search}
                    fullWidth
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                      "& .MuiInputLabel-root": { color: "#94a3b8" },
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(34,211,238,0.25)",
                      },
                    }}
                  />
                  <TextField
                    select
                    label="Status"
                    size="small"
                    value={status}
                    sx={{
                      minWidth: 180,
                      "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                      "& .MuiInputLabel-root": { color: "#94a3b8" },
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(34,211,238,0.25)",
                      },
                      "& .MuiSvgIcon-root": { color: "#22d3ee" },
                    }}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      setStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    {["ALL", "COMPLETED", "RUNNING", "FAILED"].map((v) => (
                      <MenuItem key={v} value={v}>
                        {v === "ALL" ? "All statuses" : v}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Typography
                  variant="caption"
                  sx={{ color: "#64748b", fontFamily: MONO, mt: 1, display: "block" }}
                >
                  Metrics shown as ratios. N/A = no value returned.
                </Typography>
              </CardContent>

              {filtered.length === 0 ? (
                <Typography sx={{ px: 3, pb: 3, color: "#64748b", fontFamily: MONO }}>
                  {experiments.length
                    ? "$ no experiments match these filters."
                    : "$ no experiments yet. run your first experiment to see it here."}
                </Typography>
              ) : (
                <>
                  <TableContainer>
                    <Table
                      size="small"
                      aria-label="Experiment history"
                      sx={{ bgcolor: BG2 }}
                    >
                      <TableHead>
                        <TableRow>
                          {[
                            "Experiment",
                            "Status",
                            "Created",
                            "Accuracy",
                            "Precision",
                            "Recall",
                            "F1",
                            "Results",
                          ].map((label) => (
                            <TableCell
                              key={label}
                              sx={{
                                color: "#94a3b8",
                                fontWeight: 700,
                                fontFamily: MONO,
                                borderBottom: "1px solid rgba(148,163,184,0.18)",
                              }}
                            >
                              {label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filtered
                          .slice(page * pageSize, (page + 1) * pageSize)
                          .map((exp) => (
                            <TableRow
                              key={exp.experiment_id}
                              sx={{
                                "&:hover": { bgcolor: "rgba(34,211,238,0.04)" },
                                borderBottom: "1px solid rgba(148,163,184,0.1)",
                              }}
                            >
                              <TableCell sx={{ minWidth: 180, borderBottom: "none" }}>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 700, color: "#f8fafc" }}
                                >
                                  {exp.experiment_name ||
                                    `Experiment #${exp.experiment_id}`}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ color: "#64748b", fontFamily: MONO }}
                                >
                                  #{exp.experiment_id}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ borderBottom: "none" }}>
                                <Chip
                                  size="small"
                                  label={exp.status || "Unknown"}
                                  color={statusColor(exp.status)}
                                  sx={{ fontFamily: MONO, fontWeight: 700 }}
                                />
                              </TableCell>
                              <TableCell
                                sx={{
                                  minWidth: 150,
                                  color: "#94a3b8",
                                  fontFamily: MONO,
                                  fontSize: "0.8rem",
                                  borderBottom: "none",
                                }}
                              >
                                {date(exp.created_at)}
                              </TableCell>
                              {[
                                exp.accuracy,
                                exp.precision_score,
                                exp.recall_score,
                                exp.f1_score,
                              ].map((v, i) => (
                                <TableCell
                                  key={i}
                                  sx={{
                                    color: "#67e8f9",
                                    fontFamily: MONO,
                                    borderBottom: "none",
                                  }}
                                >
                                  {numeric(v)}
                                </TableCell>
                              ))}
                              <TableCell sx={{ borderBottom: "none" }}>
                                <Button
                                  component={Link}
                                  to={`/experiments/${exp.experiment_id}`}
                                  size="small"
                                  sx={{
                                    color: "#22d3ee",
                                    fontFamily: MONO,
                                    fontWeight: 700,
                                  }}
                                  aria-label={`View experiment ${exp.experiment_id}`}
                                >
                                  View →
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={filtered.length}
                    page={page}
                    rowsPerPage={pageSize}
                    rowsPerPageOptions={[10, 25, 50]}
                    sx={{
                      bgcolor: BG2,
                      color: "#94a3b8",
                      fontFamily: MONO,
                      "& .MuiSvgIcon-root": { color: "#22d3ee" },
                      "& .MuiIconButton-root": { color: "#22d3ee" },
                      "& .Mui-disabled": { color: "#475569 !important" },
                    }}
                    onPageChange={(
                      _: MouseEvent<HTMLButtonElement> | null,
                      next: number,
                    ) => setPage(next)}
                    onRowsPerPageChange={(
                      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                    ) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                  />
                </>
              )}
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}

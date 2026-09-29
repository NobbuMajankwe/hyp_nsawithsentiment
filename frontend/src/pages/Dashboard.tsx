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
import { useAuth } from "../context/AuthContext";
import {
  listDatasets,
  listExperiments,
  type Dataset,
  type Experiment,
} from "../services/api";

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
function statusColor(status: string): "success" | "error" | "info" | "default" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "error";
  if (status === "RUNNING") return "info";
  return "default";
}

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
          experiments: runs.status === "rejected" ? message(runs.reason) : "",
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
      experiments.filter((experiment) => {
        const query = search.trim().toLowerCase();
        return (
          (status === "ALL" || experiment.status === status) &&
          (!query ||
            (experiment.experiment_name || "").toLowerCase().includes(query) ||
            String(experiment.experiment_id).includes(query))
        );
      }),
    [experiments, search, status],
  );
  const selfCorpora = datasets.filter(
    (dataset) => dataset.researchRole === "SELF_CORPUS",
  );
  const evaluationData = datasets.filter(
    (dataset) => dataset.researchRole === "EVALUATION",
  );
  const analysisData = datasets.filter(
    (dataset) => dataset.researchRole === "ANALYSIS",
  );
  const completed = experiments.filter(
    (experiment) => experiment.status === "COMPLETED",
  ).length;
  const failed = experiments.filter(
    (experiment) => experiment.status === "FAILED",
  ).length;

  if (!token)
    return (
      <Alert severity="warning">Sign in to open the research dashboard.</Alert>
    );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: {sm: "center"} }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{fontWeight:700}}>
            Research dashboard
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {user?.fullName ? `Welcome, ${user.fullName}. ` : ""}Review your
            datasets and NSA experiments.
          </Typography>
        </Box>
        <Button
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>
      <Stack direction="row" spacing={2} useFlexGap sx={{flexWrap:"wrap"}}>
        <Button variant="contained" component={Link} to="/nsa">
          Run experiment
        </Button>
        <Button variant="outlined" component={Link} to="/datasets">
          Manage datasets
        </Button>
      </Stack>
      {loading ? (
        <CircularProgress aria-label="Loading dashboard" />
      ) : (
        <>
          {errors.datasets && (
            <Alert severity="error">Datasets: {errors.datasets}</Alert>
          )}
          {errors.experiments && (
            <Alert severity="error">Experiments: {errors.experiments}</Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Counts and filters apply to the most recent records returned by the
            API (up to 50 datasets and 50 experiments).
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            {[
              {
                label: "SELF corpora",
                value: errors.datasets ? "N/A" : selfCorpora.length,
              },
              {
                label: "Evaluation datasets",
                value: errors.datasets ? "N/A" : evaluationData.length,
              },
              {
                label: "Completed experiments",
                value: errors.experiments ? "N/A" : completed,
              },
              {
                label: "Failed experiments",
                value: errors.experiments ? "N/A" : failed,
              },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    {item.label}
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {item.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {!errors.datasets && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Data preparation
                </Typography>
                <Stack spacing={1.5}>
                  <Typography color="text.secondary">
                    Use a SELF corpus for training and a separate labelled
                    evaluation dataset to measure performance.
                  </Typography>
                  <Stack direction="row" useFlexGap  sx={{ flexWrap:"wrap", spacing:1}}>
                    <Chip
                      label={`SELF corpus: ${
                        selfCorpora.length ? "available" : "not in this list"
                      }`}
                    />
                    <Chip
                      label={`Evaluation datasets: ${evaluationData.length}`}
                    />
                    <Chip label={`Analysis datasets: ${analysisData.length}`} />
                  </Stack>
                  {!datasets.length && (
                    <Alert severity="info">
                      Start by uploading your training and evaluation datasets.
                    </Alert>
                  )}
                  {!evaluationData.length && datasets.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No labelled evaluation dataset appears in this list.
                      Unlabelled analysis runs do not provide precision, recall,
                      or F1.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {!errors.experiments && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Experiment history
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Search name or ID"
                    size="small"
                    value={search}
                    fullWidth
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                  />
                  <TextField
                    select
                    label="Status"
                    size="small"
                    value={status}
                    sx={{ minWidth: 180 }}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setStatus(event.target.value);
                      setPage(0);
                    }}
                  >
                    {["ALL", "COMPLETED", "RUNNING", "FAILED"].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value === "ALL" ? "All statuses" : value}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Metrics are shown as ratios. N/A means no value was returned.
                </Typography>
              </CardContent>
              {filtered.length === 0 ? (
                <Typography sx={{ px: 2, pb: 3 }} color="text.secondary">
                  {experiments.length
                    ? "No experiments match these filters."
                    : "No experiments returned. Run your first experiment to see it here."}
                </Typography>
              ) : (
                <>
                  <TableContainer>
                    <Table size="small" aria-label="Experiment history">
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
                            <TableCell key={label}>{label}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filtered
                          .slice(page * pageSize, (page + 1) * pageSize)
                          .map((experiment) => (
                            <TableRow key={experiment.experiment_id}>
                              <TableCell sx={{ minWidth: 180 }}>
                                <Typography variant="body2" sx={{fontWeight:600}}>
                                  {experiment.experiment_name ||
                                    `Experiment #${experiment.experiment_id}`}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  #{experiment.experiment_id}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  label={experiment.status || "Unknown"}
                                  color={statusColor(experiment.status)}
                                />
                              </TableCell>
                              <TableCell sx={{ minWidth: 150 }}>
                                {date(experiment.created_at)}
                              </TableCell>
                              <TableCell>
                                {numeric(experiment.accuracy)}
                              </TableCell>
                              <TableCell>
                                {numeric(experiment.precision_score)}
                              </TableCell>
                              <TableCell>
                                {numeric(experiment.recall_score)}
                              </TableCell>
                              <TableCell>
                                {numeric(experiment.f1_score)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  component={Link}
                                  to={`/experiments/${experiment.experiment_id}`}
                                  size="small"
                                  aria-label={`View experiment ${experiment.experiment_id}`}
                                >
                                  View
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
                    onPageChange={(
                      _: MouseEvent<HTMLButtonElement> | null,
                      next: number,
                    ) => setPage(next)}
                    onRowsPerPageChange={(
                      event: ChangeEvent<
                        HTMLInputElement | HTMLTextAreaElement
                      >,
                    ) => {
                      setPageSize(Number(event.target.value));
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

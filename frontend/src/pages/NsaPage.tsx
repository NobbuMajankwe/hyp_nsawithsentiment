/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listDatasets,
  runExperiment,
  type Dataset,
  type RunRequest,
} from "../services/api";

const defaults: RunRequest = {
  datasetId: 0,
  experimentName: "",
  experimentDescription: "",
  detectorCount: 200,
  detectorRadius: 0.4,
  selfMatchThreshold: 0.75,
  maxAttempts: 10000,
  randomSeed: 42,
};
const parameters = [
  { key: "detectorCount", label: "Detector count", min: 1, max: 5000, step: 1 },
  {
    key: "detectorRadius",
    label: "Detector radius",
    min: 0.001,
    max: 2,
    step: 0.001,
  },
  {
    key: "selfMatchThreshold",
    label: "Self match threshold",
    min: 0.001,
    max: 2,
    step: 0.001,
  },
  {
    key: "maxAttempts",
    label: "Maximum attempts",
    min: 1,
    max: 1000000,
    step: 1,
  },
] as const;
type NumericField =
  | (typeof parameters)[number]["key"]
  | "datasetId"
  | "randomSeed";

function validate(
  form: RunRequest,
  candidates: Dataset[],
  hasSelf: boolean,
): string | null {
  if (!hasSelf)
    return "Upload a SELF_CORPUS dataset before running an experiment.";
  if (!candidates.some((dataset) => dataset.id === form.datasetId))
    return "Choose an evaluation or analysis dataset.";
  if (!form.experimentName.trim()) return "Enter an experiment name.";
  for (const { key, label, min, max, step } of parameters) {
    const value = form[key];
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (step === 1 && !Number.isInteger(value))
    ) {
      return `${label} must be ${
        step === 1 ? "a whole number " : ""
      }between ${min} and ${max}.`;
    }
  }
  if (!Number.isSafeInteger(form.randomSeed))
    return "Random seed must be a whole number.";
  return null;
}

export function NsaPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [form, setForm] = useState<RunRequest>(defaults);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listDatasets(token)
      .then((result: any) => {
        if (active) setDatasets(result.datasets);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Could not load datasets.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const candidates = useMemo(
    () =>
      datasets.filter(
        (dataset) =>
          dataset.researchRole === "EVALUATION" ||
          dataset.researchRole === "ANALYSIS",
      ),
    [datasets],
  );
  const hasSelf = datasets.some(
    (dataset) => dataset.researchRole === "SELF_CORPUS",
  );
  const selected = candidates.find((dataset) => dataset.id === form.datasetId);
  const issue = validate(form, candidates, hasSelf);
  function setNumber(key: NumericField, raw: string) {
    setForm((previous: any) => ({
      ...previous,
      [key]: raw === "" ? NaN : Number(raw),
    }));
  }
  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || running) return;
    const problem = validate(form, candidates, hasSelf);
    if (problem) {
      setError(problem);
      return;
    }
    setRunning(true);
    setError("");
    try {
      const result = await runExperiment(token, {
        ...form,
        experimentName: form.experimentName.trim(),
        experimentDescription: form.experimentDescription?.trim(),
      });
      navigate(`/experiments/${result.experimentId}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Experiment could not run.",
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{fontWeight:700}}>
          Run an NSA experiment
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Choose feedback, set detector parameters, and save a repeatable run.
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {loading ? (
        <CircularProgress aria-label="Loading datasets" />
      ) : (
        <>
          {!hasSelf && (
            <Alert
              severity="warning"
              action={
                <Button component={Link} to="/datasets" color="inherit">
                  Upload
                </Button>
              }
            >
              A SELF_CORPUS dataset is required for training.
            </Alert>
          )}
          {candidates.length === 0 && (
            <Alert
              severity="info"
              action={
                <Button component={Link} to="/datasets" color="inherit">
                  Upload
                </Button>
              }
            >
              Upload a labelled EVALUATION dataset or an unlabelled ANALYSIS
              dataset.
            </Alert>
          )}
          <Card component="form" onSubmit={handleRun}>
            <CardContent>
              <Stack spacing={2.5}>
                <TextField
                  select
                  required
                  fullWidth
                  label="Dataset to classify"
                  value={form.datasetId || ""}
                  onChange={(event) =>
                    setNumber("datasetId", event.target.value)
                  }
                >
                  {candidates.map((dataset) => (
                    <MenuItem key={dataset.id} value={dataset.id}>
                      {dataset.name} · {dataset.researchRole} ·{" "}
                      {dataset.totalRecords} records
                    </MenuItem>
                  ))}
                </TextField>
                {selected?.researchRole === "ANALYSIS" && (
                  <Alert severity="info">
                    This dataset has no ground-truth labels. Precision, recall,
                    and F1 will be unavailable.
                  </Alert>
                )}
                <TextField
                  required
                  label="Experiment name"
                  value={form.experimentName}
                  sx={{ maxLength: 255 }}
                  onChange={(event) =>
                    setForm((previous: any) => ({
                      ...previous,
                      experimentName: event.target.value,
                    }))
                  }
                />
                <TextField
                  label="Description (optional)"
                  multiline
                  minRows={2}
                  value={form.experimentDescription || ""}
                  onChange={(event) =>
                    setForm((previous: any) => ({
                      ...previous,
                      experimentDescription: event.target.value,
                    }))
                  }
                />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  {parameters.map(({ key, label, min, max, step }) => (
                    <TextField
                      key={key}
                      label={label}
                      type="number"
                      value={Number.isNaN(form[key]) ? "" : form[key]}
                      sx={{
    input:{min, max, step }}}
                      onChange={(event) => setNumber(key, event.target.value)}
                    />
                  ))}
                  <TextField
                    label="Random seed"
                    type="number"
                    value={Number.isNaN(form.randomSeed) ? "" : form.randomSeed}
                    sx={{ step: 1 }}
                    onChange={(event) =>
                      setNumber("randomSeed", event.target.value)
                    }
                    helperText="Use the same seed to reproduce detector generation."
                  />
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={running || Boolean(issue)}
                >
                  {running ? "Running experiment…" : "Run experiment"}
                </Button>
                {issue && (
                  <Typography variant="body2" color="text.secondary">
                    {issue}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
